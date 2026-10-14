BEGIN;
ALTER FUNCTION launchgate_private.lab_create(uuid,uuid,jsonb,uuid) RENAME TO lab_create_v7;
CREATE FUNCTION launchgate_private.lab_create(p_project uuid,p_actor uuid,p_data jsonb,p_replay uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rc public.lg_release_candidates;st public.lg_release_states;actor public.lg_organization_memberships;r public.lg_verification_runs;
 proof uuid;lab_authorization uuid;template uuid;av integer;ops text[];family text:=p_data#>>'{plan,family}';req integer;dur integer;con integer;
BEGIN
 IF p_data->>'releaseId' IS NULL THEN RETURN launchgate_private.lab_create_v7(p_project,p_actor,p_data,p_replay);END IF;
 SELECT * INTO rc FROM public.lg_release_candidates WHERE id=(p_data->>'releaseId')::uuid AND project_id=p_project;
 SELECT * INTO st FROM public.lg_release_states WHERE release_id=rc.id FOR UPDATE;
 actor:=launchgate_private.source_actor(rc.organization_id,p_actor,ARRAY['OWNER','ADMIN']);
 IF rc.identity->>'provider' IS DISTINCT FROM 'REFERENCE_LAB' OR rc.commit_sha IS DISTINCT FROM p_data->>'revision' OR st.state<>'VERIFYING' OR NOT EXISTS(SELECT 1 FROM public.lg_policy_invariants WHERE policy_id=rc.policy_id AND policy_version=rc.policy_version AND invariant_id=(p_data#>>'{plan,spec,id}')::uuid AND invariant_version=(p_data#>>'{plan,spec,version}')::int AND requirement->'invariant'=p_data#>'{plan,spec}' AND requirement->>'planHash'=p_data->>'planHash') THEN RAISE EXCEPTION 'release plan binding' USING ERRCODE='42501';END IF;
 SELECT vr.* INTO r FROM public.lg_release_runs rr JOIN public.lg_verification_runs vr ON vr.id=rr.run_id WHERE rr.release_id=rc.id AND rr.generation=st.generation AND rr.invariant_id=(p_data#>>'{plan,spec,id}')::uuid;
 IF FOUND THEN
  IF r.input_digest<>encode(sha256(convert_to(p_data::text,'UTF8')),'hex') THEN RAISE EXCEPTION 'release run conflict' USING ERRCODE='22023';END IF;RETURN r.id;
 END IF;
 IF octet_length(p_data::text)>32768 OR p_data#>>'{plan,spec,confirmation,status}' IS DISTINCT FROM 'CONFIRMED' OR p_data#>>'{plan,spec,provenance,source}' IS DISTINCT FROM 'reference_lab' THEN RAISE EXCEPTION 'registered lab required';END IF;
 req:=CASE WHEN family IN ('ai_cost_controls','critical_browser_journeys') THEN 128 WHEN family IN ('billing_entitlements','webhook_integrity') THEN 64 ELSE 32 END;
 dur:=CASE WHEN req=128 THEN 180 WHEN req=64 THEN 120 ELSE 60 END;con:=(p_data#>>'{plan,budget,concurrency}')::int;
 IF (p_data#>>'{plan,budget,requests}')::int IS DISTINCT FROM req OR (p_data#>>'{plan,budget,durationMs}')::int IS DISTINCT FROM dur*1000 OR con NOT IN (1,2) THEN RAISE EXCEPTION 'lab budget';END IF;
 ops:=CASE WHEN family='ai_cost_controls' THEN ARRAY['ai.invoke','quota.concurrent_attempt'] WHEN family='critical_browser_journeys' THEN ARRAY['journey.execute_registered'] WHEN req=64 THEN ARRAY['payment.observe','webhook.deliver_test_event'] ELSE ARRAY['resource.read','resource.write','role.change','session.check'] END;
 PERFORM 1 FROM public.lg_deployments WHERE id=rc.deployment_id FOR UPDATE;
 SELECT coalesce(max(version),0)+1 INTO av FROM public.lg_target_authorizations WHERE deployment_id=rc.deployment_id;
 INSERT INTO public.lg_authorization_proofs(organization_id,project_id,deployment_id,method,digest,expires_at) VALUES(rc.organization_id,p_project,rc.deployment_id,'REFERENCE_LAB_HARNESS',substring(p_data->>'sourceDigest' from 8),now()+interval '30 minutes') RETURNING id INTO proof;
 INSERT INTO public.lg_target_authorizations(organization_id,project_id,deployment_id,proof_id,principal_id,principal_role,version,expires_at,request_limit,concurrency_limit,duration_seconds,request_key) VALUES(rc.organization_id,p_project,rc.deployment_id,proof,p_actor,actor.role,av,now()+interval '30 minutes',req,con,dur,gen_random_uuid()) RETURNING id INTO lab_authorization;
 INSERT INTO public.lg_target_allowlists(organization_id,project_id,authorization_id,hostname,operations) VALUES(rc.organization_id,p_project,lab_authorization,'reference-lab.invalid',ops);
 INSERT INTO public.lg_fixture_templates(organization_id,project_id,family,version,variant,source_digest) VALUES(rc.organization_id,p_project,family,1,p_data->>'variant',p_data->>'sourceDigest') RETURNING id INTO template;
 INSERT INTO public.lg_verification_runs(organization_id,project_id,deployment_id,authorization_id,authorization_version,commit_sha,policy_version,requested_by,request_key,input_digest,purpose) VALUES(rc.organization_id,p_project,rc.deployment_id,lab_authorization,av,rc.commit_sha,1,p_actor,(p_data->>'requestKey')::uuid,encode(sha256(convert_to(p_data::text,'UTF8')),'hex'),'REFERENCE_LAB') RETURNING * INTO r;
 INSERT INTO public.lg_test_cases VALUES(r.id,rc.organization_id,p_project,template,(p_data#>>'{plan,spec,id}')::uuid,(p_data#>>'{plan,spec,version}')::int,p_data->'plan',p_data->>'planHash',p_data#>>'{plan,seed}',p_replay);
 INSERT INTO public.lg_release_runs VALUES(rc.organization_id,p_project,rc.id,(p_data#>>'{plan,spec,id}')::uuid,st.generation,r.id);
 IF p_replay IS NOT NULL THEN
  PERFORM 1 FROM public.lg_findings WHERE id=p_replay AND organization_id=rc.organization_id AND project_id=p_project AND plan_hash=p_data->>'planHash' AND invariant_id=(p_data#>>'{plan,spec,id}')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'release replay oracle changed' USING ERRCODE='42501';END IF;
  INSERT INTO public.lg_replay_attempts VALUES(r.id,rc.organization_id,p_project,p_replay,(p_data->>'requestKey')::uuid);
  UPDATE public.lg_findings SET state='FIX_VERIFICATION',active_replay=r.id,updated_at=now() WHERE id=p_replay;
  INSERT INTO public.lg_finding_events(organization_id,project_id,finding_id,run_id,state) VALUES(rc.organization_id,p_project,p_replay,r.id,'FIX_VERIFICATION');
 END IF;
 INSERT INTO public.lg_jobs(organization_id,project_id,run_id) VALUES(rc.organization_id,p_project,r.id);
 PERFORM launchgate_private.release_event(p_project,rc.id,p_actor,'VERIFICATION_SCHEDULED',r.id);
 PERFORM launchgate_private.run_event(r,'RUN_CREATED');PERFORM launchgate_private.run_event(r,'JOB_QUEUED');RETURN r.id;
END $$;
ALTER FUNCTION public.lg_execution_service(text,jsonb) RENAME TO lg_execution_service_v7;
CREATE FUNCTION public.lg_execution_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;binding jsonb;rid uuid;BEGIN
 result:=public.lg_execution_service_v7(p_action,p_data);
 IF p_action IN ('CLAIM','LAB_CONTEXT') AND result IS NOT NULL THEN
  rid:=CASE WHEN p_action='CLAIM' THEN (result#>>'{run,id}')::uuid ELSE (p_data->>'runId')::uuid END;
  SELECT jsonb_build_object('releaseId',rc.id,'policyId',rc.policy_id,'policyVersion',rc.policy_version) INTO binding FROM public.lg_release_runs rr JOIN public.lg_release_candidates rc ON rc.id=rr.release_id WHERE rr.run_id=rid;
  IF binding IS NOT NULL THEN result:=result||jsonb_build_object('releasePolicy',binding);END IF;
 END IF;RETURN result;
END $$;
ALTER FUNCTION public.lg_release_service(text,jsonb) RENAME TO lg_release_service_v8;
CREATE FUNCTION public.lg_release_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rc public.lg_release_candidates;env uuid;dep uuid;org uuid;s public.lg_repository_snapshots;head jsonb;base jsonb;result jsonb;BEGIN
 IF p_action='LAB_DEPLOYMENT' THEN
  SELECT organization_id INTO org FROM public.lg_projects WHERE id=(p_data->>'projectId')::uuid;
  PERFORM launchgate_private.source_actor(org,(p_data->>'actorId')::uuid,ARRAY['OWNER','ADMIN']);
  INSERT INTO public.lg_environments(organization_id,project_id,name,type) VALUES(org,(p_data->>'projectId')::uuid,'Reference Lab Release','SANDBOX') RETURNING id INTO env;
  INSERT INTO public.lg_deployments(organization_id,project_id,environment_id,provider,provider_deployment_id,target_url,commit_sha,verification_state) VALUES(org,(p_data->>'projectId')::uuid,env,'REFERENCE_LAB','dpl_lab'||replace(gen_random_uuid()::text,'-',''),'https://reference-lab.invalid/',p_data->>'revision','HARNESS_CONTROLLED') RETURNING id INTO dep;
  RETURN jsonb_build_object('deploymentId',dep);
 ELSIF p_action IN ('SCHEDULE_LAB','SOURCES') THEN
  PERFORM public.lg_release_service_v8('CHECK',p_data);
  SELECT * INTO rc FROM public.lg_release_candidates WHERE id=(p_data->>'releaseId')::uuid;
  IF p_action='SCHEDULE_LAB' THEN RETURN to_jsonb(launchgate_private.lab_create(rc.project_id,rc.requested_by,p_data->'run'||jsonb_build_object('releaseId',rc.id),(p_data->>'findingId')::uuid));END IF;
  SELECT * INTO s FROM public.lg_repository_snapshots WHERE id=rc.snapshot_id;
  IF s.id IS NOT NULL THEN
   SELECT jsonb_build_object('id',s.id,'connectionId',s.connection_id,'commitSha',s.commit_sha,'files',coalesce((SELECT jsonb_agg(jsonb_build_object('path',f.path,'digest',f.digest,'blobSha',f.blob_sha)) FROM public.lg_source_files f WHERE f.snapshot_id=s.id),'[]'::jsonb),'report',a.report) INTO head FROM public.lg_architecture_snapshots a WHERE a.snapshot_id=s.id;
   SELECT * INTO s FROM public.lg_repository_snapshots WHERE connection_id=rc.connection_id AND commit_sha=rc.identity->>'baseSha' AND state='COMPLETE';
   IF s.id IS NOT NULL THEN SELECT jsonb_build_object('id',s.id,'connectionId',s.connection_id,'commitSha',s.commit_sha,'files',coalesce((SELECT jsonb_agg(jsonb_build_object('path',f.path,'digest',f.digest,'blobSha',f.blob_sha)) FROM public.lg_source_files f WHERE f.snapshot_id=s.id),'[]'::jsonb),'report',a.report) INTO base FROM public.lg_architecture_snapshots a WHERE a.snapshot_id=s.id;END IF;
  END IF;
  RETURN jsonb_build_object('head',head,'base',base);
 END IF;
 result:=public.lg_release_service_v8(p_action,p_data);RETURN result;
END $$;
REVOKE ALL ON FUNCTION launchgate_private.lab_create(uuid,uuid,jsonb,uuid),launchgate_private.lab_create_v7(uuid,uuid,jsonb,uuid),public.lg_execution_service_v7(text,jsonb),public.lg_execution_service(text,jsonb),public.lg_release_service_v8(text,jsonb),public.lg_release_service(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_execution_service(text,jsonb),public.lg_release_service(text,jsonb) TO service_role;
COMMIT;
