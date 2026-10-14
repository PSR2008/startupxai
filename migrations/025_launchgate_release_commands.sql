BEGIN;
CREATE FUNCTION launchgate_private.release_event(p_project uuid,p_release uuid,p_actor uuid,p_kind text,p_reference uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;actor public.lg_organization_memberships;BEGIN
 SELECT organization_id INTO org FROM public.lg_projects WHERE id=p_project;actor:=launchgate_private.source_actor(org,p_actor,ARRAY['OWNER','ADMIN','DEVELOPER']);
 INSERT INTO public.lg_release_events(organization_id,project_id,release_id,kind,actor_id,reference_id) VALUES(org,p_project,p_release,p_kind,p_actor,p_reference);
 PERFORM launchgate_private.append_audit(org,actor,'EXECUTION_COMMAND','PROJECT',p_project,gen_random_uuid());
END $$;
CREATE FUNCTION public.lg_release_command(p_project uuid,p_action text,p_data jsonb,p_correlation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;actor public.lg_organization_memberships;pid uuid;v integer;r public.lg_release_candidates;pv public.lg_policy_versions;entry jsonb;x uuid;
BEGIN
 SELECT organization_id INTO org FROM public.lg_projects WHERE id=p_project AND status='ACTIVE';
 actor:=launchgate_private.require_actor(org,CASE WHEN p_action='REEVALUATE' THEN ARRAY['OWNER','ADMIN','DEVELOPER'] ELSE ARRAY['OWNER','ADMIN'] END);
 IF p_data IS NULL OR octet_length(p_data::text)>1048576 THEN RAISE EXCEPTION 'payload limit' USING ERRCODE='22023';END IF;
 IF p_action='POLICY' THEN
  pid:=(p_data#>>'{policy,id}')::uuid;v:=(p_data#>>'{policy,version}')::int;
  PERFORM pg_advisory_xact_lock(hashtextextended(pid::text,0));
  IF v IS NULL OR v<1 OR jsonb_array_length(p_data#>'{policy,requirements}') NOT BETWEEN 1 AND 1000 OR p_data#>>'{policy,minimumCoverage}' IS DISTINCT FROM '1' OR p_data#>>'{policy,requiredInconclusive}' IS DISTINCT FROM 'NON_APPROVAL' THEN RAISE EXCEPTION 'invalid policy' USING ERRCODE='22023';END IF;
  IF v=1 THEN INSERT INTO public.lg_verification_policies(id,organization_id,project_id,name,created_by) VALUES(pid,org,p_project,p_data->>'name',auth.uid());
  ELSIF NOT EXISTS(SELECT 1 FROM public.lg_verification_policies WHERE id=pid AND project_id=p_project AND organization_id=org) OR v<>(SELECT max(version)+1 FROM public.lg_policy_versions WHERE policy_id=pid) THEN RAISE EXCEPTION 'policy version' USING ERRCODE='42501';END IF;
  INSERT INTO public.lg_policy_versions VALUES(org,p_project,pid,v,p_data->'policy',p_data->>'invariantSetDigest',auth.uid(),now());
  FOR entry IN SELECT value FROM jsonb_array_elements(p_data#>'{policy,requirements}') LOOP
   INSERT INTO public.lg_policy_invariants VALUES(org,p_project,pid,v,(entry#>>'{invariant,id}')::uuid,(entry#>>'{invariant,version}')::int,entry);
  END LOOP;
  PERFORM launchgate_private.release_event(p_project,NULL,auth.uid(),'POLICY_CREATED',pid);RETURN jsonb_build_object('policyId',pid,'version',v);
 ELSIF p_action='CONFIGURE' THEN
  INSERT INTO public.lg_release_configurations VALUES(org,p_project,(p_data->>'connectionId')::uuid,(p_data->>'policyId')::uuid,(p_data->>'policyVersion')::int,(p_data->>'environmentId')::uuid,auth.uid(),true)
  ON CONFLICT(connection_id) DO UPDATE SET policy_id=EXCLUDED.policy_id,policy_version=EXCLUDED.policy_version,environment_id=EXCLUDED.environment_id,requested_by=EXCLUDED.requested_by,enabled=true WHERE lg_release_configurations.project_id=p_project;
  PERFORM launchgate_private.release_event(p_project,NULL,auth.uid(),'POLICY_CONFIGURED');RETURN '{}'::jsonb;
 END IF;
 SELECT * INTO r FROM public.lg_release_candidates WHERE id=(p_data->>'releaseId')::uuid AND project_id=p_project AND organization_id=org;
 IF NOT FOUND THEN RAISE EXCEPTION 'release access' USING ERRCODE='42501';END IF;
 SELECT * INTO pv FROM public.lg_policy_versions WHERE policy_id=r.policy_id AND version=r.policy_version;
 IF p_action='EXCEPTION' THEN
  IF pv.policy->>'allowExceptions' IS DISTINCT FROM 'true' OR (p_data->>'expiresAt')::timestamptz>now()+make_interval(secs=>(pv.policy->>'maximumExceptionSeconds')::int) OR NOT EXISTS(SELECT 1 FROM public.lg_policy_invariants WHERE policy_id=r.policy_id AND policy_version=r.policy_version AND invariant_id=(p_data->>'invariantId')::uuid) OR
   (p_data->>'findingId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.lg_findings WHERE id=(p_data->>'findingId')::uuid AND project_id=p_project AND invariant_id=(p_data->>'invariantId')::uuid)) THEN RAISE EXCEPTION 'exception scope' USING ERRCODE='42501';END IF;
  INSERT INTO public.lg_policy_exceptions(organization_id,project_id,release_id,invariant_id,finding_id,reason,actor_id,actor_role,expires_at,ticket) VALUES(org,p_project,r.id,(p_data->>'invariantId')::uuid,(p_data->>'findingId')::uuid,p_data->>'reason',auth.uid(),actor.role,(p_data->>'expiresAt')::timestamptz,p_data->>'ticket') RETURNING id INTO x;
  PERFORM launchgate_private.release_event(p_project,r.id,auth.uid(),'EXCEPTION_CREATED',x);RETURN jsonb_build_object('id',x);
 ELSIF p_action='REVOKE_EXCEPTION' THEN
  UPDATE public.lg_policy_exceptions SET revoked_at=now() WHERE id=(p_data->>'exceptionId')::uuid AND release_id=r.id AND revoked_at IS NULL RETURNING id INTO x;
  IF x IS NULL THEN RAISE EXCEPTION 'exception access' USING ERRCODE='42501';END IF;
  PERFORM launchgate_private.release_event(p_project,r.id,auth.uid(),'EXCEPTION_REVOKED',x);
 ELSIF p_action='REEVALUATE' THEN
  -- Do not race an active evaluation/publication lease.
  PERFORM 1 FROM public.lg_release_states WHERE release_id=r.id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM launchgate_private.release_leases WHERE release_id=r.id AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'release busy' USING ERRCODE='55000';END IF;
  UPDATE public.lg_release_states SET generation=generation+1,state='READY',updated_at=now() WHERE release_id=r.id AND state='DECIDED';
  IF NOT FOUND THEN RAISE EXCEPTION 'release state' USING ERRCODE='55000';END IF;
  UPDATE public.lg_github_check_runs SET publication_state='SUPERSEDED' WHERE evaluation_id IN (SELECT id FROM public.lg_gate_evaluations WHERE release_id=r.id) AND publication_state='PENDING';
  PERFORM launchgate_private.release_event(p_project,r.id,auth.uid(),'MANUAL_REEVALUATION');
 ELSE RAISE EXCEPTION 'invalid release command' USING ERRCODE='22023';END IF;
 RETURN '{}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.lg_release_command(uuid,text,jsonb,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.lg_release_command(uuid,text,jsonb,uuid) TO authenticated;

CREATE FUNCTION public.lg_release_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.lg_release_candidates;pv public.lg_policy_versions;dep public.lg_deployments;env public.lg_environments;
 org uuid;actor uuid;rid uuid;identity jsonb;result jsonb;entry jsonb;x uuid;st public.lg_release_states;l launchgate_private.release_leases;
 config public.lg_release_configurations;delivery launchgate_private.release_deliveries;snap public.lg_repository_snapshots;
BEGIN
 IF p_data IS NULL OR octet_length(p_data::text)>4194304 THEN RAISE EXCEPTION 'payload limit' USING ERRCODE='22023';END IF;
 IF p_action='CREATE' THEN
  SELECT * INTO pv FROM public.lg_policy_versions WHERE project_id=(p_data->>'projectId')::uuid AND policy_id=(p_data->>'policyId')::uuid AND version=(p_data->>'policyVersion')::int;
  org:=pv.organization_id;actor:=(p_data->>'actorId')::uuid;
  PERFORM launchgate_private.source_actor(org,actor,ARRAY['OWNER','ADMIN']);
  SELECT * INTO dep FROM public.lg_deployments WHERE id=(p_data->>'deploymentId')::uuid AND organization_id=org AND project_id=pv.project_id;
  SELECT * INTO env FROM public.lg_environments WHERE id=dep.environment_id AND status='ACTIVE';
  IF dep.id IS NULL OR env.id IS NULL OR NOT (pv.policy->'environments' ? env.type) THEN RAISE EXCEPTION 'deployment binding' USING ERRCODE='42501';END IF;
  IF dep.provider='VERCEL' THEN
   SELECT * INTO snap FROM public.lg_repository_snapshots WHERE id=(p_data->>'snapshotId')::uuid AND project_id=pv.project_id AND connection_id=dep.repository_connection_id AND commit_sha=dep.commit_sha AND state='COMPLETE';
   IF snap.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.lg_repository_connections WHERE id=dep.repository_connection_id AND status='ACTIVE') THEN RAISE EXCEPTION 'source binding' USING ERRCODE='42501';END IF;
  END IF;
  SELECT * INTO r FROM public.lg_release_candidates WHERE project_id=pv.project_id AND commit_sha=dep.commit_sha AND deployment_id=dep.id AND policy_id=pv.policy_id AND policy_version=pv.version;
  IF FOUND THEN RETURN to_jsonb(r);END IF;
  rid:=gen_random_uuid();
  IF dep.repository_connection_id IS NOT NULL THEN
   UPDATE public.lg_release_states SET state='SUPERSEDED',updated_at=now() WHERE release_id IN (SELECT id FROM public.lg_release_candidates WHERE connection_id=dep.repository_connection_id AND commit_sha=dep.commit_sha);
   UPDATE public.lg_github_check_runs SET publication_state='SUPERSEDED' WHERE connection_id=dep.repository_connection_id AND head_sha=dep.commit_sha AND publication_state='PENDING';
  END IF;
  identity:=jsonb_build_object('id',rid,'candidate',jsonb_build_object('organizationId',org,'projectId',pv.project_id,'commitSha',dep.commit_sha,'deploymentId',dep.id,'policyId',pv.policy_id,'policyVersion',pv.version,'evidenceScope',CASE WHEN dep.provider='REFERENCE_LAB' THEN 'REFERENCE_LAB' ELSE 'CUSTOMER_VERIFICATION' END,'purpose',CASE WHEN dep.provider='REFERENCE_LAB' THEN 'REFERENCE_LAB' ELSE 'CUSTOMER_VERIFICATION' END),
   'repositoryConnectionId',dep.repository_connection_id,'snapshotId',snap.id,'provider',dep.provider,'providerDeploymentId',dep.provider_deployment_id,'deploymentCommitSha',dep.commit_sha,'environmentId',dep.environment_id,'environment',env.type,'invariantSetDigest',pv.invariant_set_digest,'requestedBy',actor,'createdAt',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'baseSha',p_data->>'baseSha','headSha',dep.commit_sha,'pullRequest',(p_data->>'pullRequest')::int,'branch',p_data->>'branch');
  INSERT INTO public.lg_release_candidates VALUES(rid,org,pv.project_id,dep.repository_connection_id,snap.id,dep.id,dep.commit_sha,pv.policy_id,pv.version,identity,actor,now()) RETURNING * INTO r;
  INSERT INTO public.lg_release_states(organization_id,project_id,release_id) VALUES(org,pv.project_id,rid);
  PERFORM launchgate_private.release_event(r.project_id,rid,actor,'RELEASE_CREATED');RETURN to_jsonb(r);
 ELSIF p_action='DELIVERY' THEN
  INSERT INTO launchgate_private.release_deliveries(app_id,delivery_id,installation_id,repository_id,head_sha,base_sha,pull_request,payload_digest,rerun)
  VALUES((p_data->>'appId')::bigint,(p_data->>'deliveryId')::uuid,(p_data->>'installationId')::bigint,(p_data->>'repositoryId')::bigint,p_data->>'headSha',p_data->>'baseSha',(p_data->>'pullRequest')::int,p_data->>'digest',coalesce((p_data->>'rerun')::boolean,false)) ON CONFLICT DO NOTHING;
  IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM launchgate_private.release_deliveries WHERE app_id=(p_data->>'appId')::bigint AND delivery_id=(p_data->>'deliveryId')::uuid AND payload_digest=p_data->>'digest') THEN RAISE EXCEPTION 'delivery conflict' USING ERRCODE='22023';END IF;
  RETURN '{}'::jsonb;
 ELSIF p_action='DISCOVER' THEN
  -- Verified snapshots and deployments are ingested through the existing source
  -- and provider pipelines. A webhook payload alone cannot create either fact.
  FOR delivery IN SELECT * FROM launchgate_private.release_deliveries WHERE state='WAITING_FOR_DEPLOYMENT' ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
   FOR config IN SELECT c.* FROM public.lg_release_configurations c JOIN public.lg_repository_connections rc ON rc.id=c.connection_id JOIN public.lg_installation_repositories ir ON ir.id=rc.repository_id JOIN public.lg_github_installations gi ON gi.id=ir.installation_id WHERE c.enabled AND rc.status='ACTIVE' AND gi.status='ACTIVE' AND gi.app_id=delivery.app_id AND gi.installation_id=delivery.installation_id AND ir.repository_id=delivery.repository_id LOOP
    SELECT d.* INTO dep FROM public.lg_deployments d WHERE d.repository_connection_id=config.connection_id AND d.environment_id=config.environment_id AND d.commit_sha=delivery.head_sha ORDER BY d.created_at DESC LIMIT 1;
    SELECT s.* INTO snap FROM public.lg_repository_snapshots s WHERE s.connection_id=config.connection_id AND s.commit_sha=delivery.head_sha AND s.state='COMPLETE';
    IF dep.id IS NOT NULL AND snap.id IS NOT NULL THEN
     result:=public.lg_release_service('CREATE',jsonb_build_object('projectId',config.project_id,'policyId',config.policy_id,'policyVersion',config.policy_version,'actorId',config.requested_by,'deploymentId',dep.id,'snapshotId',snap.id,'baseSha',delivery.base_sha,'pullRequest',delivery.pull_request));
     IF delivery.rerun THEN
      IF EXISTS(SELECT 1 FROM launchgate_private.release_leases WHERE release_id=(result->>'id')::uuid AND expires_at>clock_timestamp()) THEN CONTINUE;END IF;
      UPDATE public.lg_release_states SET generation=generation+1,state='READY',updated_at=now() WHERE release_id=(result->>'id')::uuid AND state='DECIDED';
      IF FOUND THEN PERFORM launchgate_private.release_event(config.project_id,(result->>'id')::uuid,config.requested_by,'GITHUB_CHECK_REREQUESTED');END IF;
     END IF;
     UPDATE launchgate_private.release_deliveries SET state='DISCOVERED' WHERE app_id=delivery.app_id AND delivery_id=delivery.delivery_id;
    END IF;
   END LOOP;
  END LOOP;RETURN '{}'::jsonb;
 ELSIF p_action='CLAIM' THEN
  SELECT s.* INTO st FROM public.lg_release_states s JOIN public.lg_release_candidates c ON c.id=s.release_id WHERE s.state IN ('READY','VERIFYING','EVALUATING','DECIDED') AND
   (s.state<>'DECIDED' OR EXISTS(SELECT 1 FROM public.lg_github_check_runs g JOIN public.lg_gate_evaluations e ON e.id=g.evaluation_id WHERE e.release_id=s.release_id AND g.publication_state='PENDING')) AND
   NOT EXISTS(SELECT 1 FROM launchgate_private.release_leases le WHERE le.release_id=s.release_id AND le.expires_at>clock_timestamp()) ORDER BY s.updated_at LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL;END IF;
  INSERT INTO launchgate_private.release_leases VALUES(st.release_id,(p_data->>'workerId')::uuid,1,clock_timestamp()+interval '60 seconds') ON CONFLICT(release_id) DO UPDATE SET worker_id=EXCLUDED.worker_id,fence=release_leases.fence+1,expires_at=EXCLUDED.expires_at RETURNING * INTO l;
  RETURN jsonb_build_object('releaseId',st.release_id,'fence',l.fence,'generation',st.generation);
 END IF;
 SELECT * INTO r FROM public.lg_release_candidates WHERE id=(p_data->>'releaseId')::uuid;
 SELECT * INTO st FROM public.lg_release_states WHERE release_id=r.id FOR UPDATE;
 SELECT * INTO l FROM launchgate_private.release_leases WHERE release_id=r.id AND worker_id=(p_data->>'workerId')::uuid AND fence=(p_data->>'fence')::bigint AND expires_at>clock_timestamp();
 IF l.release_id IS NULL OR st.state IN ('SUPERSEDED','CANCELLED') THEN RAISE EXCEPTION 'release fence' USING ERRCODE='42501';END IF;
 PERFORM launchgate_private.source_actor(r.organization_id,r.requested_by,ARRAY['OWNER','ADMIN']);
 UPDATE launchgate_private.release_leases SET expires_at=clock_timestamp()+interval '60 seconds' WHERE release_id=r.id;
 SELECT * INTO pv FROM public.lg_policy_versions WHERE policy_id=r.policy_id AND version=r.policy_version;
 IF p_action='CHECK' THEN RETURN '{}'::jsonb;
 ELSIF p_action='LOAD' THEN
  RETURN jsonb_build_object('release',r.identity,'policy',pv.policy,'state',st.state,'generation',st.generation,
   'runs',coalesce((SELECT jsonb_agg(jsonb_build_object('invariantId',rr.invariant_id,'run',to_jsonb(vr),'authorization',to_jsonb(ta),'proof',to_jsonb(ap),'bundle',rb.bundle,'manifestDigest',rb.manifest_digest)) FROM public.lg_release_runs rr JOIN public.lg_verification_runs vr ON vr.id=rr.run_id JOIN public.lg_target_authorizations ta ON ta.id=vr.authorization_id JOIN public.lg_authorization_proofs ap ON ap.id=ta.proof_id LEFT JOIN public.lg_reproduction_bundles rb ON rb.run_id=vr.id WHERE rr.release_id=r.id AND rr.generation=st.generation),'[]'::jsonb),
   'exceptions',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.lg_policy_exceptions e WHERE e.release_id=r.id),'[]'::jsonb),
   'findings',coalesce((SELECT jsonb_agg(to_jsonb(f)||jsonb_build_object('regression_invariant_id',f.invariant_id,'origin',(
    SELECT jsonb_build_object('invariantId',f.invariant_id,'run',to_jsonb(vr),'authorization',to_jsonb(ta),'proof',to_jsonb(ap),'bundle',rb.bundle,'manifestDigest',rb.manifest_digest)
    FROM public.lg_finding_occurrences fo JOIN public.lg_verification_runs vr ON vr.id=fo.run_id JOIN public.lg_target_authorizations ta ON ta.id=vr.authorization_id JOIN public.lg_authorization_proofs ap ON ap.id=ta.proof_id JOIN public.lg_reproduction_bundles rb ON rb.run_id=vr.id
    WHERE fo.finding_id=f.id AND fo.outcome='REPRODUCIBLE_FAILURE' ORDER BY vr.created_at DESC LIMIT 1))) FROM public.lg_findings f WHERE f.project_id=r.project_id),'[]'::jsonb),
   'dependencies',coalesce((SELECT jsonb_agg(mapping) FROM public.lg_invariant_dependencies WHERE policy_id=r.policy_id AND policy_version=r.policy_version),'[]'::jsonb),
   'evaluation',(SELECT to_jsonb(e) FROM public.lg_gate_evaluations e WHERE e.release_id=r.id AND e.generation=st.generation),
   'check',(SELECT to_jsonb(g) FROM public.lg_github_check_runs g JOIN public.lg_gate_evaluations e ON e.id=g.evaluation_id WHERE e.release_id=r.id AND e.generation=st.generation),
   'repository',(SELECT jsonb_build_object('repositoryId',ir.repository_id,'installationId',gi.installation_id) FROM public.lg_repository_connections rc JOIN public.lg_installation_repositories ir ON ir.id=rc.repository_id JOIN public.lg_github_installations gi ON gi.id=ir.installation_id WHERE rc.id=r.connection_id AND rc.status='ACTIVE' AND gi.status='ACTIVE'));
 ELSIF p_action='SELECTION' THEN
  IF st.state<>'READY' THEN RAISE EXCEPTION 'release state';END IF;
  UPDATE public.lg_release_states SET selection=p_data->'selection',state='VERIFYING',updated_at=now() WHERE release_id=r.id;
  PERFORM launchgate_private.release_event(r.project_id,r.id,r.requested_by,'VERIFICATION_SELECTED');
 ELSIF p_action='COMPLETE' THEN
  IF st.state NOT IN ('VERIFYING','EVALUATING') OR (p_data#>>'{evaluation,releaseId}')::uuid IS DISTINCT FROM r.id OR p_data#>'{evaluation,candidate}' IS DISTINCT FROM r.identity->'candidate' THEN RAISE EXCEPTION 'evaluation scope' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM public.lg_release_runs rr JOIN public.lg_verification_runs vr ON vr.id=rr.run_id WHERE rr.release_id=r.id AND rr.generation=st.generation AND vr.state NOT IN ('COMPLETED','CANCELLED','FAILED_INFRASTRUCTURE')) THEN RAISE EXCEPTION 'runs pending';END IF;
  INSERT INTO public.lg_gate_evaluations(organization_id,project_id,release_id,generation,decision,evaluation) VALUES(r.organization_id,r.project_id,r.id,st.generation,p_data#>>'{evaluation,decision}',p_data->'evaluation') RETURNING id INTO x;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_data#>'{evaluation,coverage}') LOOP INSERT INTO public.lg_gate_evaluation_items VALUES(r.organization_id,r.project_id,x,(entry->>'invariantId')::uuid,entry->>'status',entry);END LOOP;
  IF r.connection_id IS NOT NULL THEN
   UPDATE public.lg_github_check_runs SET publication_state='SUPERSEDED' WHERE connection_id=r.connection_id AND head_sha=r.commit_sha AND publication_state='PENDING';
   INSERT INTO public.lg_github_check_runs(organization_id,project_id,connection_id,head_sha,evaluation_id) VALUES(r.organization_id,r.project_id,r.connection_id,r.commit_sha,x);
  END IF;
  UPDATE public.lg_release_states SET state='DECIDED',actual_cost=coalesce((p_data->>'actualCost')::numeric,0),duration_ms=coalesce((p_data->>'durationMs')::bigint,0),updated_at=now() WHERE release_id=r.id;
  PERFORM launchgate_private.release_event(r.project_id,r.id,r.requested_by,'GATE_EVALUATED',x);
 ELSIF p_action='PUBLISHED' THEN
  UPDATE public.lg_github_check_runs SET check_id=(p_data->>'checkId')::bigint,publication_state='PUBLISHED' WHERE evaluation_id=(p_data->>'evaluationId')::uuid AND publication_state='PENDING' AND evaluation_id IN (SELECT id FROM public.lg_gate_evaluations WHERE release_id=r.id AND generation=st.generation);
  IF NOT FOUND THEN RAISE EXCEPTION 'publication superseded' USING ERRCODE='42501';END IF;
  PERFORM launchgate_private.release_event(r.project_id,r.id,r.requested_by,'GITHUB_CHECK_PUBLISHED',(p_data->>'evaluationId')::uuid);
 ELSIF p_action='RELEASE' THEN UPDATE launchgate_private.release_leases SET expires_at=clock_timestamp() WHERE release_id=r.id;
 ELSE RAISE EXCEPTION 'invalid service command' USING ERRCODE='22023';END IF;
 RETURN '{}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION launchgate_private.release_event(uuid,uuid,uuid,text,uuid),public.lg_release_service(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_release_service(text,jsonb) TO service_role;
COMMIT;
