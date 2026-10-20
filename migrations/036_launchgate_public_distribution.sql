BEGIN;
CREATE TABLE public.lg_release_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,evaluation_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz,revoked_at timestamptz,CHECK(expires_at IS NULL OR expires_at>created_at),
 FOREIGN KEY(organization_id,project_id,evaluation_id) REFERENCES public.lg_gate_evaluations(organization_id,project_id,id)
);
CREATE TABLE public.lg_public_assurance_settings (
 project_id uuid PRIMARY KEY,organization_id uuid NOT NULL,slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-f0-9]{32}$'),enabled boolean NOT NULL DEFAULT false,
 configured_by uuid NOT NULL REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id)
);
CREATE TABLE launchgate_private.distribution_limits (key text PRIMARY KEY,window_start timestamptz NOT NULL,count integer NOT NULL);
CREATE TABLE launchgate_private.public_assessments (cache_key text PRIMARY KEY CHECK(cache_key ~ '^[a-f0-9]{64}$'),lease uuid,lease_expires_at timestamptz,result jsonb CHECK(octet_length(result::text)<=65536),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE launchgate_private.distribution_telemetry (day date NOT NULL,event text NOT NULL CHECK(event IN ('cli_init','cli_inspect','cli_check','github_action_check','public_assessment','assessment_connect_cta','share_created','badge_view','public_assurance_view')),count bigint NOT NULL DEFAULT 0,PRIMARY KEY(day,event));
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['lg_release_shares','lg_public_assurance_settings'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING(launchgate_private.has_role(organization_id,ARRAY[''OWNER'',''ADMIN'']))',t||'_read',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['distribution_limits','public_assessments','distribution_telemetry'] LOOP
  EXECUTE format('ALTER TABLE launchgate_private.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE launchgate_private.%I FORCE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON launchgate_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
GRANT SELECT(id,project_id,evaluation_id,created_by,created_at,expires_at,revoked_at) ON public.lg_release_shares TO authenticated;
GRANT SELECT ON public.lg_public_assurance_settings TO authenticated;

CREATE FUNCTION public.lg_sharing_command(p_project uuid,p_action text,p_data jsonb,p_correlation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.lg_projects;actor public.lg_organization_memberships;s public.lg_release_shares;a public.lg_public_assurance_settings;g public.lg_gate_evaluations;
BEGIN
 SELECT * INTO p FROM public.lg_projects WHERE id=p_project AND status='ACTIVE';IF NOT FOUND THEN RAISE EXCEPTION 'project access' USING ERRCODE='42501';END IF;
 actor:=launchgate_private.require_actor(p.organization_id,ARRAY['OWNER','ADMIN']);
 IF p_action='SHARE_CREATE' THEN
  IF p_data->>'confirm' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'sharing confirmation required' USING ERRCODE='22023';END IF;
  SELECT * INTO g FROM public.lg_gate_evaluations WHERE project_id=p.id AND release_id=(p_data->>'releaseId')::uuid ORDER BY generation DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'evaluation access' USING ERRCODE='42501';END IF;
  INSERT INTO public.lg_release_shares(organization_id,project_id,evaluation_id,token_hash,created_by,expires_at) VALUES(p.organization_id,p.id,g.id,p_data->>'hash',auth.uid(),(p_data->>'expiresAt')::timestamptz) RETURNING * INTO s;
  PERFORM launchgate_private.append_audit(p.organization_id,actor,'SHARE_CREATED','PROJECT',p.id,p_correlation);RETURN to_jsonb(s)-'token_hash';
 ELSIF p_action='SHARE_REVOKE' THEN
  UPDATE public.lg_release_shares SET revoked_at=coalesce(revoked_at,now()) WHERE id=(p_data->>'id')::uuid AND project_id=p.id RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION 'share access' USING ERRCODE='42501';END IF;
  PERFORM launchgate_private.append_audit(p.organization_id,actor,'SHARE_REVOKED','PROJECT',p.id,p_correlation);RETURN to_jsonb(s)-'token_hash';
 ELSIF p_action IN ('PUBLIC_ENABLE','PUBLIC_DISABLE') THEN
  IF p_action='PUBLIC_ENABLE' THEN
   IF p_data->>'confirm' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'public confirmation required' USING ERRCODE='22023';END IF;
   IF p.purpose<>'REFERENCE_LAB' AND NOT EXISTS(SELECT 1 FROM public.lg_repository_connections c JOIN public.lg_installation_repositories r ON r.id=c.repository_id WHERE c.project_id=p.id AND c.status='ACTIVE' AND r.visibility='PUBLIC') THEN RAISE EXCEPTION 'public repository required' USING ERRCODE='42501';END IF;
  END IF;
  INSERT INTO public.lg_public_assurance_settings(project_id,organization_id,slug,enabled,configured_by) VALUES(p.id,p.organization_id,p_data->>'slug',p_action='PUBLIC_ENABLE',auth.uid()) ON CONFLICT(project_id) DO UPDATE SET enabled=excluded.enabled,configured_by=excluded.configured_by,updated_at=now() RETURNING * INTO a;
  PERFORM launchgate_private.append_audit(p.organization_id,actor,CASE WHEN a.enabled THEN 'PUBLIC_ENABLED' ELSE 'PUBLIC_DISABLED' END,'PROJECT',p.id,p_correlation);
  PERFORM launchgate_private.append_audit(p.organization_id,actor,'BADGE_CONFIGURED','PROJECT',p.id,p_correlation);RETURN to_jsonb(a);
 END IF;
 RAISE EXCEPTION 'sharing action' USING ERRCODE='22023';
END $$;

CREATE FUNCTION launchgate_private.assurance_projection(p_evaluation uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('schemaVersion',1,'type','RELEASE_ASSURANCE','displayName',p.name,'purpose',p.purpose,'releaseId',r.id,'evaluationId',g.id,'commit',left(r.commit_sha,12),'commitSha',r.commit_sha,'decision',g.decision,'policyVersion',r.policy_version,'policyName','Configured release policy','evaluatedAt',g.created_at,'validUntil',g.evaluation->>'validUntil','engineVersion','lg-release-1',
 'coverage',jsonb_build_object('required',count(i.invariant_id) FILTER(WHERE i.item->>'required'='true'),'passed',count(i.invariant_id) FILTER(WHERE i.status='PASS'),'failed',count(i.invariant_id) FILTER(WHERE i.status='REPRODUCIBLE_FAILURE'),'incomplete',count(i.invariant_id) FILTER(WHERE i.status IN ('NOT_RUN','INCONCLUSIVE','STALE'))),
 'explanation',CASE g.decision WHEN 'SHIP' THEN 'LaunchGate release policy was satisfied for the tested scope.' WHEN 'BLOCK' THEN 'One or more reproducible policy-blocking failures were found.' ELSE 'Required assurance could not be completed.' END)
 FROM public.lg_gate_evaluations g JOIN public.lg_release_candidates r ON r.id=g.release_id JOIN public.lg_projects p ON p.id=r.project_id JOIN public.lg_organizations o ON o.id=p.organization_id LEFT JOIN public.lg_gate_evaluation_items i ON i.evaluation_id=g.id WHERE g.id=p_evaluation AND p.status='ACTIVE' AND o.status='ACTIVE' GROUP BY p.id,r.id,g.id
$$;
CREATE FUNCTION public.lg_public_distribution(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.lg_release_shares;a public.lg_public_assurance_settings;r public.lg_release_candidates;g public.lg_gate_evaluations;st public.lg_release_states;result jsonb;state text;cache launchgate_private.public_assessments;n integer;k text;
BEGIN
 IF p_action='RATE' THEN
  -- Serialize all admission decisions: bounded global work, independent of spoofed IPs.
  PERFORM pg_advisory_xact_lock(120036);
  IF p_data->>'surface'='assessment' AND EXISTS(SELECT 1 FROM launchgate_private.distribution_limits WHERE key='provider-backoff' AND window_start>now()-interval '1 minute') THEN RETURN jsonb_build_object('allowed',false);END IF;
  DELETE FROM launchgate_private.distribution_limits WHERE window_start<now()-interval '2 hours';
  FOREACH k IN ARRAY ARRAY['global:'||(p_data->>'surface'),'client:'||(p_data->>'surface')||':'||(p_data->>'client')] LOOP
   INSERT INTO launchgate_private.distribution_limits(key,window_start,count) VALUES(k,date_trunc('hour',now()),1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN distribution_limits.window_start=date_trunc('hour',now()) THEN distribution_limits.count+1 ELSE 1 END,window_start=date_trunc('hour',now()) RETURNING count INTO n;
   IF n>(CASE WHEN p_data->>'surface'='assessment' THEN CASE WHEN k LIKE 'global:%' THEN 100 ELSE 10 END ELSE CASE WHEN k LIKE 'global:%' THEN 10000 ELSE 600 END END) THEN RETURN jsonb_build_object('allowed',false);END IF;
  END LOOP;RETURN jsonb_build_object('allowed',true);
 ELSIF p_action='CACHE_CLAIM' THEN
  PERFORM pg_advisory_xact_lock(120036);
  DELETE FROM launchgate_private.public_assessments WHERE created_at<now()-interval '7 days';
  SELECT * INTO cache FROM launchgate_private.public_assessments WHERE cache_key=p_data->>'key' FOR UPDATE;
  IF cache.result IS NOT NULL THEN RETURN jsonb_build_object('cached',cache.result);END IF;
  IF EXISTS(SELECT 1 FROM launchgate_private.distribution_limits WHERE key='provider-backoff' AND window_start>now()-interval '1 minute') OR cache.lease_expires_at>now() OR (SELECT count(*) FROM launchgate_private.public_assessments WHERE lease_expires_at>now())>=2 THEN RETURN jsonb_build_object('busy',true);END IF;
  INSERT INTO launchgate_private.public_assessments(cache_key,lease,lease_expires_at) VALUES(p_data->>'key',gen_random_uuid(),now()+interval '45 seconds') ON CONFLICT(cache_key) DO UPDATE SET lease=excluded.lease,lease_expires_at=excluded.lease_expires_at RETURNING * INTO cache;
  RETURN jsonb_build_object('lease',cache.lease);
 ELSIF p_action IN ('CACHE_COMPLETE','CACHE_FAIL') THEN
  IF p_action='CACHE_COMPLETE' AND (p_data#>>'{result,type}' IS DISTINCT FROM 'STATIC_ASSESSMENT' OR p_data#>'{result,decision}' IS NOT NULL) THEN RAISE EXCEPTION 'static result boundary' USING ERRCODE='22023';END IF;
  UPDATE launchgate_private.public_assessments SET result=CASE WHEN p_action='CACHE_COMPLETE' THEN p_data->'result' END,lease=NULL,lease_expires_at=NULL WHERE cache_key=p_data->>'key' AND lease=(p_data->>'lease')::uuid AND lease_expires_at>now();
  RETURN '{}'::jsonb;
 ELSIF p_action='BACKOFF' THEN
  INSERT INTO launchgate_private.distribution_limits VALUES('provider-backoff',now(),1) ON CONFLICT(key) DO UPDATE SET window_start=now();RETURN '{}'::jsonb;
 ELSIF p_action='TELEMETRY' THEN
  INSERT INTO launchgate_private.distribution_telemetry(day,event,count) VALUES(current_date,p_data->>'event',1) ON CONFLICT(day,event) DO UPDATE SET count=distribution_telemetry.count+1;
  DELETE FROM launchgate_private.distribution_telemetry WHERE day<current_date-90;RETURN '{}'::jsonb;
 ELSIF p_action='SHARE' THEN
  SELECT * INTO s FROM public.lg_release_shares WHERE token_hash=p_data->>'hash' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now());
  IF NOT FOUND THEN RETURN NULL;END IF;
  result:=launchgate_private.assurance_projection(s.evaluation_id);
  RETURN result||jsonb_build_object('historical',true,'freshness',CASE WHEN result->>'decision'='SHIP' AND (result->>'validUntil')::timestamptz<=now() THEN 'STALE' ELSE 'HISTORICAL' END);
 ELSIF p_action IN ('PUBLIC_IDENTITY','BADGE') THEN
  SELECT setting.* INTO a FROM public.lg_public_assurance_settings setting JOIN public.lg_projects project ON project.id=setting.project_id JOIN public.lg_organizations organization ON organization.id=project.organization_id WHERE setting.slug=p_data->>'slug' AND setting.enabled AND project.status='ACTIVE' AND organization.status='ACTIVE';
  IF NOT FOUND THEN RETURN NULL;END IF;
  IF p_action='PUBLIC_IDENTITY' THEN
   RETURN (SELECT jsonb_build_object('purpose',p.purpose,'repository',(SELECT ir.owner_login||'/'||ir.name FROM public.lg_repository_connections c JOIN public.lg_installation_repositories ir ON ir.id=c.repository_id WHERE c.project_id=p.id AND c.status='ACTIVE' AND ir.visibility='PUBLIC' ORDER BY c.created_at DESC LIMIT 1)) FROM public.lg_projects p WHERE p.id=a.project_id AND p.status='ACTIVE');
  END IF;
  SELECT * INTO r FROM public.lg_release_candidates WHERE project_id=a.project_id ORDER BY created_at DESC,id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('schemaVersion',1,'state','NOT_CONFIGURED');END IF;
  SELECT * INTO st FROM public.lg_release_states WHERE release_id=r.id;
  SELECT * INTO g FROM public.lg_gate_evaluations WHERE release_id=r.id AND generation=st.generation;
  state:=CASE g.decision WHEN 'SHIP' THEN 'VERIFIED' WHEN 'BLOCK' THEN 'BLOCKED' ELSE 'INCONCLUSIVE' END;
  IF g.id IS NULL THEN state:='STALE';
  ELSIF st.state<>'DECIDED' OR (g.decision='SHIP' AND ((g.evaluation->>'validUntil')::timestamptz IS NULL OR (g.evaluation->>'validUntil')::timestamptz<=now())) OR EXISTS(SELECT 1 FROM public.lg_policy_versions WHERE project_id=r.project_id AND policy_id=r.policy_id AND version>r.policy_version) OR EXISTS(SELECT 1 FROM public.lg_release_configurations WHERE project_id=r.project_id AND enabled AND (policy_id<>r.policy_id OR policy_version<>r.policy_version)) THEN state:='STALE';END IF;
  IF EXISTS(SELECT 1 FROM public.lg_projects WHERE id=r.project_id AND purpose<>'REFERENCE_LAB') AND (p_data->>'currentSha' IS NULL OR p_data->>'currentSha'<>r.commit_sha) THEN state:='STALE';END IF;
  result:=coalesce(launchgate_private.assurance_projection(g.id),'{}');
  RETURN result||jsonb_build_object('schemaVersion',1,'state',state,'historical',false);
 END IF;
 RAISE EXCEPTION 'public action' USING ERRCODE='22023';
END $$;
REVOKE ALL ON FUNCTION public.lg_sharing_command(uuid,text,jsonb,uuid),launchgate_private.assurance_projection(uuid),public.lg_public_distribution(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_sharing_command(uuid,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lg_public_distribution(text,jsonb) TO service_role;
COMMIT;
