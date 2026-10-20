BEGIN;
CREATE TABLE public.lg_ci_credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),secret_hash text NOT NULL UNIQUE CHECK(secret_hash ~ '^[a-f0-9]{64}$'),
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL CHECK(expires_at>created_at AND expires_at<=created_at+interval '90 days'),
 revoked_at timestamptz,last_used_at timestamptz,FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id)
);
CREATE TABLE public.lg_cli_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),secret_hash text NOT NULL UNIQUE CHECK(secret_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day',revoked_at timestamptz,last_used_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '1 day')
);
ALTER TABLE public.lg_ci_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lg_ci_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lg_cli_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lg_cli_sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.lg_ci_credentials,public.lg_cli_sessions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(id,organization_id,project_id,name,created_by,created_at,expires_at,revoked_at,last_used_at) ON public.lg_ci_credentials TO authenticated;
CREATE POLICY lg_ci_metadata ON public.lg_ci_credentials FOR SELECT TO authenticated USING(launchgate_private.has_role(organization_id,ARRAY['OWNER','ADMIN']));
GRANT SELECT(id,user_id,created_at,expires_at,revoked_at,last_used_at) ON public.lg_cli_sessions TO authenticated;
CREATE POLICY lg_cli_metadata ON public.lg_cli_sessions FOR SELECT TO authenticated USING(user_id=auth.uid());
ALTER TABLE public.lg_audit_events DROP CONSTRAINT lg_audit_events_operation_check;
ALTER TABLE public.lg_audit_events ADD CONSTRAINT lg_audit_events_operation_check CHECK(operation IN ('ORGANIZATION_CREATED','MEMBER_ADDED','MEMBER_UPDATED','MEMBER_REMOVED','OWNERSHIP_TRANSFERRED','PROJECT_CREATED','RETENTION_UPDATED','DELETION_REQUESTED','GITHUB_SETUP_STARTED','GITHUB_CONNECTED','GITHUB_DISCONNECTED','SNAPSHOT_REQUESTED','INVARIANT_REVIEWED','EXECUTION_COMMAND','CI_CREATED','CI_ROTATED','CI_REVOKED','SHARE_CREATED','SHARE_REVOKED','PUBLIC_ENABLED','PUBLIC_DISABLED','BADGE_CONFIGURED','ASSESSMENT_CONNECTED'));

CREATE FUNCTION public.lg_distribution_identity(p_project uuid,p_action text,p_data jsonb,p_correlation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.lg_projects;actor public.lg_organization_memberships;c public.lg_ci_credentials;s public.lg_cli_sessions;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'identity access' USING ERRCODE='42501';END IF;
 IF p_action='HUMAN_CREATE' THEN
  INSERT INTO public.lg_cli_sessions(user_id,secret_hash) VALUES(auth.uid(),p_data->>'hash') RETURNING * INTO s;
  RETURN to_jsonb(s)-'secret_hash';
 ELSIF p_action='HUMAN_REVOKE' THEN
  UPDATE public.lg_cli_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE id=(p_data->>'id')::uuid AND user_id=auth.uid();RETURN '{}'::jsonb;
 END IF;
 SELECT * INTO p FROM public.lg_projects WHERE id=p_project AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'project access' USING ERRCODE='42501';END IF;
 actor:=launchgate_private.require_actor(p.organization_id,ARRAY['OWNER','ADMIN']);
 IF p_action='CI_CREATE' THEN
  INSERT INTO public.lg_ci_credentials(organization_id,project_id,name,secret_hash,created_by,expires_at) VALUES(p.organization_id,p.id,p_data->>'name',p_data->>'hash',auth.uid(),(p_data->>'expiresAt')::timestamptz) RETURNING * INTO c;
 ELSIF p_action IN ('CI_REVOKE','CI_ROTATE') THEN
  SELECT * INTO c FROM public.lg_ci_credentials WHERE id=(p_data->>'id')::uuid AND project_id=p.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'credential access' USING ERRCODE='42501';END IF;
  IF p_action='CI_REVOKE' THEN UPDATE public.lg_ci_credentials SET revoked_at=coalesce(revoked_at,now()) WHERE id=c.id RETURNING * INTO c;
  ELSE
   IF c.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'credential revoked' USING ERRCODE='42501';END IF;
   UPDATE public.lg_ci_credentials SET secret_hash=p_data->>'hash',expires_at=least((p_data->>'expiresAt')::timestamptz,c.created_at+interval '90 days') WHERE id=c.id RETURNING * INTO c;
  END IF;
 ELSE RAISE EXCEPTION 'identity action' USING ERRCODE='22023';END IF;
 PERFORM launchgate_private.append_audit(p.organization_id,actor,CASE p_action WHEN 'CI_CREATE' THEN 'CI_CREATED' WHEN 'CI_ROTATE' THEN 'CI_ROTATED' ELSE 'CI_REVOKED' END,'PROJECT',p.id,p_correlation);
 RETURN to_jsonb(c)-'secret_hash';
END $$;

-- Credential hash possession authenticates only this constrained distribution RPC.
-- It never creates a Supabase/user principal or provides access to other RPCs.
CREATE FUNCTION public.lg_distribution_machine(p_kind text,p_hash text,p_project uuid,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.lg_ci_credentials;s public.lg_cli_sessions;p public.lg_projects;r public.lg_release_candidates;g public.lg_gate_evaluations;st public.lg_release_states;decision text;result jsonb;
BEGIN
 IF p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'credential access' USING ERRCODE='42501';END IF;
 IF p_kind='CI' THEN
  SELECT * INTO c FROM public.lg_ci_credentials WHERE secret_hash=p_hash AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND OR c.project_id IS DISTINCT FROM p_project THEN RAISE EXCEPTION 'credential access' USING ERRCODE='42501';END IF;
  UPDATE public.lg_ci_credentials SET last_used_at=now() WHERE id=c.id;
 ELSIF p_kind='HUMAN' THEN
  SELECT * INTO s FROM public.lg_cli_sessions WHERE secret_hash=p_hash AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'credential access' USING ERRCODE='42501';END IF;
  IF p_action='LOGOUT' THEN UPDATE public.lg_cli_sessions SET revoked_at=now() WHERE id=s.id;RETURN jsonb_build_object('schemaVersion',1,'type','LOGGED_OUT');END IF;
  UPDATE public.lg_cli_sessions SET last_used_at=now() WHERE id=s.id;
  IF p_action='WHOAMI' THEN RETURN jsonb_build_object('schemaVersion',1,'type','HUMAN_SESSION','userId',s.user_id,'expiresAt',s.expires_at);END IF;
 ELSE RAISE EXCEPTION 'credential kind' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.lg_projects WHERE id=p_project AND status='ACTIVE' AND EXISTS(SELECT 1 FROM public.lg_organizations o WHERE o.id=organization_id AND o.status='ACTIVE');
 IF NOT FOUND OR (p_kind='HUMAN' AND NOT EXISTS(SELECT 1 FROM public.lg_organization_memberships WHERE organization_id=p.organization_id AND user_id=s.user_id AND status='ACTIVE')) THEN RAISE EXCEPTION 'project access' USING ERRCODE='42501';END IF;
 IF p_action='RELEASES' THEN
  SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM (SELECT id,commit_sha,policy_id,policy_version,created_at FROM public.lg_release_candidates WHERE project_id=p.id ORDER BY created_at DESC,id LIMIT 50)x;
  RETURN jsonb_build_object('schemaVersion',1,'type','RELEASES','projectId',p.id,'items',result);
 ELSIF p_action='FINDINGS' AND p_kind='HUMAN' THEN
  SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM (SELECT id,invariant_id,state,created_at FROM public.lg_findings WHERE project_id=p.id ORDER BY created_at DESC,id LIMIT 50)x;
  RETURN jsonb_build_object('schemaVersion',1,'type','FINDINGS','projectId',p.id,'items',result);
 ELSIF p_action NOT IN ('CHECK','RECONCILE') THEN RAISE EXCEPTION 'capability denied' USING ERRCODE='42501';END IF;
 IF p_action='CHECK' THEN SELECT * INTO r FROM public.lg_release_candidates WHERE project_id=p.id AND id=(p_data->>'releaseId')::uuid;
 ELSE
  IF p_data->>'commitSha' !~ '^[a-f0-9]{40}$' THEN RAISE EXCEPTION 'commit identity' USING ERRCODE='22023';END IF;
  SELECT * INTO r FROM public.lg_release_candidates WHERE project_id=p.id AND commit_sha=p_data->>'commitSha' AND (p_data->>'baseSha' IS NULL OR identity->>'baseSha'=p_data->>'baseSha') ORDER BY created_at DESC,id LIMIT 1;
 END IF;
 IF NOT FOUND THEN RETURN jsonb_build_object('schemaVersion',1,'type','RELEASE_PENDING','projectId',p.id,'decision','INCONCLUSIVE');END IF;
 SELECT * INTO st FROM public.lg_release_states WHERE release_id=r.id;
 SELECT * INTO g FROM public.lg_gate_evaluations WHERE release_id=r.id AND generation=st.generation;
 decision:=CASE WHEN st.state='DECIDED' AND g.id IS NOT NULL AND (g.decision<>'SHIP' OR (g.evaluation->>'validUntil')::timestamptz>now()) THEN g.decision ELSE 'INCONCLUSIVE' END;
 RETURN jsonb_build_object('schemaVersion',1,'type','RELEASE_CHECK','projectId',p.id,'releaseId',r.id,'commitSha',r.commit_sha,'baseSha',r.identity->>'baseSha','policyId',r.policy_id,'policyVersion',r.policy_version,'deploymentId',r.deployment_id,'coverage',(SELECT jsonb_build_object('required',count(*) FILTER(WHERE item->>'required'='true'),'passed',count(*) FILTER(WHERE status='PASS'),'failed',count(*) FILTER(WHERE status='REPRODUCIBLE_FAILURE'),'incomplete',count(*) FILTER(WHERE status IN ('NOT_RUN','INCONCLUSIVE','STALE'))) FROM public.lg_gate_evaluation_items WHERE evaluation_id=g.id),'findings',(SELECT jsonb_build_object('reproducibleFailures',count(*) FILTER(WHERE status='REPRODUCIBLE_FAILURE')) FROM public.lg_gate_evaluation_items WHERE evaluation_id=g.id),'decision',decision,'validUntil',CASE WHEN decision='SHIP' THEN g.evaluation->>'validUntil' END);
END $$;
REVOKE ALL ON FUNCTION public.lg_distribution_identity(uuid,text,jsonb,uuid),public.lg_distribution_machine(text,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_distribution_identity(uuid,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lg_distribution_machine(text,text,uuid,text,jsonb) TO service_role;
COMMIT;
