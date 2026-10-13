BEGIN;
ALTER FUNCTION launchgate_private.execution_authorized(public.lg_verification_runs) RENAME TO execution_authorized_v4;
CREATE FUNCTION launchgate_private.execution_authorized(r public.lg_verification_runs) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN r.purpose<>'REFERENCE_LAB' THEN launchgate_private.execution_authorized_v4(r) ELSE EXISTS(
  SELECT 1 FROM public.lg_target_authorizations a JOIN public.lg_authorization_proofs p ON p.id=a.proof_id JOIN public.lg_deployments d ON d.id=a.deployment_id
  JOIN public.lg_environments e ON e.id=d.environment_id JOIN public.lg_projects pr ON pr.id=r.project_id JOIN public.lg_organizations o ON o.id=r.organization_id
  JOIN public.lg_test_cases c ON c.run_id=r.id
  WHERE a.id=r.authorization_id AND a.version=r.authorization_version AND a.deployment_id=r.deployment_id AND d.commit_sha=r.commit_sha
  AND d.provider='REFERENCE_LAB' AND d.verification_state='HARNESS_CONTROLLED' AND d.target_url='https://reference-lab.invalid/' AND p.method='REFERENCE_LAB_HARNESS'
  AND a.revoked_at IS NULL AND p.revoked_at IS NULL AND a.starts_at<=clock_timestamp() AND a.expires_at>clock_timestamp() AND p.expires_at>clock_timestamp()
  AND e.status='ACTIVE' AND pr.status='ACTIVE' AND o.status='ACTIVE'
  AND EXISTS(SELECT 1 FROM public.lg_organization_memberships WHERE organization_id=r.organization_id AND user_id=r.requested_by AND status='ACTIVE' AND role IN ('OWNER','ADMIN','DEVELOPER'))
  AND EXISTS(SELECT 1 FROM public.lg_organization_memberships WHERE organization_id=r.organization_id AND user_id=a.principal_id AND status='ACTIVE' AND role IN ('OWNER','ADMIN')))
 END
$$;
CREATE FUNCTION launchgate_private.lab_create(p_project uuid,p_actor uuid,p_data jsonb,p_replay uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;actor public.lg_organization_memberships;env uuid;dep uuid;proof uuid;lab_authorization uuid;template uuid;r public.lg_verification_runs;
BEGIN
 SELECT organization_id INTO org FROM public.lg_projects WHERE id=p_project AND status='ACTIVE';
 actor:=launchgate_private.source_actor(org,p_actor,ARRAY['OWNER','ADMIN']);
 SELECT * INTO r FROM public.lg_verification_runs WHERE project_id=p_project AND request_key=(p_data->>'requestKey')::uuid;
 IF FOUND THEN
  IF r.input_digest<>encode(sha256(convert_to(p_data::text,'UTF8')),'hex') OR r.purpose<>'REFERENCE_LAB' OR EXISTS(SELECT 1 FROM public.lg_test_cases WHERE run_id=r.id AND replay_of IS DISTINCT FROM p_replay) THEN RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='22023'; END IF;RETURN r.id;
 END IF;
 IF octet_length(p_data::text)>32768 OR p_data#>>'{plan,spec,confirmation,status}' IS DISTINCT FROM 'CONFIRMED' OR p_data#>>'{plan,spec,provenance,source}' IS DISTINCT FROM 'reference_lab' THEN RAISE EXCEPTION 'lab plan required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.lg_environments(organization_id,project_id,name,type) VALUES(org,p_project,'Reference Lab','SANDBOX') RETURNING id INTO env;
 INSERT INTO public.lg_deployments(organization_id,project_id,environment_id,provider,provider_deployment_id,target_url,commit_sha,verification_state)
 VALUES(org,p_project,env,'REFERENCE_LAB','dpl_lab'||replace(gen_random_uuid()::text,'-',''),'https://reference-lab.invalid/',p_data->>'revision','HARNESS_CONTROLLED') RETURNING id INTO dep;
 INSERT INTO public.lg_authorization_proofs(organization_id,project_id,deployment_id,method,digest,expires_at) VALUES(org,p_project,dep,'REFERENCE_LAB_HARNESS',substring(p_data->>'sourceDigest' from 8),now()+interval '30 minutes') RETURNING id INTO proof;
 INSERT INTO public.lg_target_authorizations(organization_id,project_id,deployment_id,proof_id,principal_id,principal_role,version,expires_at,request_limit,concurrency_limit,duration_seconds,request_key)
 VALUES(org,p_project,dep,proof,p_actor,actor.role,1,now()+interval '30 minutes',32,1,60,gen_random_uuid()) RETURNING id INTO lab_authorization;
 INSERT INTO public.lg_target_allowlists(organization_id,project_id,authorization_id,hostname,operations) VALUES(org,p_project,lab_authorization,'reference-lab.invalid',ARRAY['resource.read','resource.write','role.change','session.check']);
 INSERT INTO public.lg_fixture_templates(organization_id,project_id,family,version,variant,source_digest) VALUES(org,p_project,p_data#>>'{plan,family}',1,p_data->>'variant',p_data->>'sourceDigest') RETURNING id INTO template;
 INSERT INTO public.lg_verification_runs(organization_id,project_id,deployment_id,authorization_id,authorization_version,commit_sha,policy_version,requested_by,request_key,input_digest,purpose)
 VALUES(org,p_project,dep,lab_authorization,1,p_data->>'revision',1,p_actor,(p_data->>'requestKey')::uuid,encode(sha256(convert_to(p_data::text,'UTF8')),'hex'),'REFERENCE_LAB') RETURNING * INTO r;
 INSERT INTO public.lg_test_cases VALUES(r.id,org,p_project,template,(p_data#>>'{plan,spec,id}')::uuid,(p_data#>>'{plan,spec,version}')::int,p_data->'plan',p_data->>'planHash',p_data#>>'{plan,seed}',p_replay);
 INSERT INTO public.lg_jobs(organization_id,project_id,run_id) VALUES(org,p_project,r.id);
 PERFORM launchgate_private.append_audit(org,actor,'EXECUTION_COMMAND','PROJECT',p_project,gen_random_uuid());
 PERFORM launchgate_private.run_event(r,'RUN_CREATED');PERFORM launchgate_private.run_event(r,'JOB_QUEUED');RETURN r.id;
END $$;

CREATE FUNCTION public.lg_finding_replay(p_project uuid,p_finding uuid,p_variant text,p_request_key uuid,p_correlation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.lg_findings;c public.lg_test_cases;t public.lg_fixture_templates;r public.lg_verification_runs;actor public.lg_organization_memberships;new_run uuid;
BEGIN
 SELECT * INTO f FROM public.lg_findings WHERE id=p_finding AND project_id=p_project;
 actor:=launchgate_private.require_actor(f.organization_id,ARRAY['OWNER','ADMIN']);
 SELECT * INTO f FROM public.lg_findings WHERE id=p_finding AND project_id=p_project FOR UPDATE;
 IF p_variant IS NULL OR p_variant NOT IN ('fixed','vulnerable','inconclusive') OR f.state NOT IN ('REPRODUCED','RESOLVED','REGRESSION_FAILED','FIX_VERIFICATION','INCONCLUSIVE') OR NOT EXISTS(SELECT 1 FROM public.lg_regression_tests WHERE finding_id=f.id) THEN RAISE EXCEPTION 'reproduced finding required' USING ERRCODE='42501'; END IF;
 -- A retry after completion must not reopen a resolved finding or supersede a newer replay.
 SELECT ra.run_id INTO new_run FROM public.lg_replay_attempts ra WHERE ra.project_id=p_project AND ra.request_key=p_request_key;
 IF FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.lg_test_cases tc JOIN public.lg_fixture_templates ft ON ft.id=tc.template_id WHERE tc.run_id=new_run AND tc.replay_of=f.id AND ft.variant=p_variant) THEN RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='22023';END IF;
  RETURN new_run;
 END IF;
 SELECT tc.* INTO c FROM public.lg_test_cases tc JOIN public.lg_finding_occurrences o ON o.run_id=tc.run_id WHERE o.finding_id=f.id AND o.outcome='REPRODUCIBLE_FAILURE' AND tc.plan_hash=f.plan_hash ORDER BY tc.run_id LIMIT 1;
 SELECT * INTO t FROM public.lg_fixture_templates WHERE id=c.template_id;SELECT * INTO r FROM public.lg_verification_runs WHERE id=c.run_id;
 new_run:=launchgate_private.lab_create(p_project,auth.uid(),jsonb_build_object('requestKey',p_request_key,'plan',c.plan,'planHash',c.plan_hash,'variant',p_variant,'sourceDigest',t.source_digest,'revision',r.commit_sha),f.id);
 INSERT INTO public.lg_replay_attempts VALUES(new_run,f.organization_id,p_project,f.id,p_request_key) ON CONFLICT DO NOTHING;
 UPDATE public.lg_findings SET state='FIX_VERIFICATION',active_replay=new_run,updated_at=now() WHERE id=f.id;
 INSERT INTO public.lg_finding_events(organization_id,project_id,finding_id,run_id,state) VALUES(f.organization_id,p_project,f.id,new_run,'FIX_VERIFICATION');
 PERFORM launchgate_private.append_audit(f.organization_id,actor,'EXECUTION_COMMAND','PROJECT',p_project,p_correlation);RETURN new_run;
END $$;

ALTER FUNCTION public.lg_execution_service(text,jsonb) RENAME TO lg_execution_service_v4;
REVOKE ALL ON FUNCTION public.lg_execution_service_v4(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.lg_execution_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;r public.lg_verification_runs;a public.lg_job_attempts;c public.lg_test_cases;t public.lg_fixture_templates;f public.lg_findings;
 row jsonb;entry record;fixture uuid;ordinal integer:=0;next_state text;manifest jsonb;
BEGIN
 IF octet_length(p_data::text)>262144 THEN RAISE EXCEPTION 'payload limit' USING ERRCODE='22023'; END IF;
 IF p_action='LAB_CREATE' THEN RETURN jsonb_build_object('id',launchgate_private.lab_create((p_data->>'projectId')::uuid,(p_data->>'actorId')::uuid,p_data)); END IF;
 IF p_action='LAB_CONTEXT' THEN
  SELECT * INTO c FROM public.lg_test_cases WHERE run_id=(p_data->>'runId')::uuid;
  SELECT * INTO t FROM public.lg_fixture_templates WHERE id=c.template_id;
  RETURN jsonb_build_object('case',to_jsonb(c),'template',to_jsonb(t));
 END IF;
 IF p_action='LAB_COMPLETE' THEN
  SELECT * INTO a FROM public.lg_job_attempts WHERE id=(p_data->>'attemptId')::uuid;
  SELECT * INTO r FROM public.lg_verification_runs WHERE id=a.run_id;
  PERFORM 1 FROM public.lg_organizations WHERE id=r.organization_id FOR UPDATE;
  -- The original gateway revalidates grant, membership, authorization and fence.
  PERFORM public.lg_execution_service_v4('CHECK',p_data);
  SELECT * INTO a FROM public.lg_job_attempts WHERE id=a.id;
  SELECT * INTO c FROM public.lg_test_cases WHERE run_id=r.id;
  IF r.purpose<>'REFERENCE_LAB' OR c.plan_hash IS DISTINCT FROM p_data->>'planHash' OR p_data->>'outcome' NOT IN ('PASS','REPRODUCIBLE_FAILURE','INCONCLUSIVE') OR (p_data->>'requests')::int IS DISTINCT FROM a.requests THEN RAISE EXCEPTION 'lab binding' USING ERRCODE='42501'; END IF;
  IF a.state='COMPLETED' THEN
   IF EXISTS(SELECT 1 FROM public.lg_reproduction_bundles WHERE run_id=r.id AND manifest_digest=p_data->>'manifestDigest') THEN RETURN jsonb_build_object('duplicate',true);END IF;
   RAISE EXCEPTION 'completion conflict' USING ERRCODE='22023';
  END IF;
  IF NOT (p_data->'bundle' @> jsonb_build_object('runId',r.id,'attemptId',a.id,'deploymentId',r.deployment_id,'commitSha',r.commit_sha,'authorizationId',r.authorization_id,'authorizationVersion',r.authorization_version,'fence',a.fence,'planHash',c.plan_hash)) THEN RAISE EXCEPTION 'bundle binding' USING ERRCODE='42501'; END IF;
  IF jsonb_array_length(p_data->'traces') NOT BETWEEN 1 AND 2 OR (p_data->>'outcome'='REPRODUCIBLE_FAILURE' AND jsonb_array_length(p_data->'traces')<>2) THEN RAISE EXCEPTION 'reproduction required' USING ERRCODE='22023'; END IF;
  FOR row IN SELECT * FROM jsonb_array_elements(p_data->'traces') LOOP
   ordinal:=ordinal+1;
   INSERT INTO public.lg_fixture_sets(organization_id,project_id,run_id,attempt_id,seed,cleanup) VALUES(r.organization_id,r.project_id,r.id,a.id,c.seed,CASE WHEN (row->>'cleanup')::boolean THEN 'COMPLETED' ELSE 'FAILED' END) RETURNING id INTO fixture;
   FOR entry IN SELECT * FROM jsonb_each_text(row#>'{mapping,identities}') LOOP INSERT INTO public.lg_test_identities VALUES(r.organization_id,r.project_id,fixture,entry.key,entry.value::uuid);END LOOP;
   FOR entry IN SELECT * FROM jsonb_each_text(row#>'{mapping,resources}') LOOP INSERT INTO public.lg_synthetic_resources VALUES(r.organization_id,r.project_id,fixture,entry.key,entry.value::uuid);END LOOP;
   INSERT INTO public.lg_test_attempts VALUES((row->>'id')::uuid,r.organization_id,r.project_id,r.id,a.id,fixture,ordinal,row,'sha256:'||encode(sha256(convert_to(row::text,'UTF8')),'hex'));
  END LOOP;
  INSERT INTO public.lg_observations VALUES(r.organization_id,r.project_id,a.id,p_data->'traces');
  INSERT INTO public.lg_assertion_results(organization_id,project_id,run_id,invariant_id,result,assertions) VALUES(r.organization_id,r.project_id,r.id,c.invariant_id,p_data->>'outcome',p_data->'assertions');
  INSERT INTO public.lg_reproduction_bundles VALUES(r.organization_id,r.project_id,r.id,a.id,p_data->>'manifestDigest',p_data->'bundle');
  INSERT INTO public.lg_artifacts VALUES((p_data#>>'{artifact,id}')::uuid,r.organization_id,r.project_id,r.id,a.id,'REFERENCE_LAB_TRACE',p_data#>>'{artifact,hash}',(p_data#>>'{artifact,size}')::int,'INTERNAL','NO_SENSITIVE_DATA',p_data#>>'{artifact,reference}',now()+interval '7 days');
  manifest:=p_data->'bundle';
  INSERT INTO public.lg_evidence_manifests(organization_id,project_id,run_id,attempt_id,digest,manifest) VALUES(r.organization_id,r.project_id,r.id,a.id,p_data->>'manifestDigest',manifest);
  IF c.replay_of IS NOT NULL THEN
   SELECT * INTO f FROM public.lg_findings WHERE id=c.replay_of AND organization_id=r.organization_id AND project_id=r.project_id FOR UPDATE;
   IF f.plan_hash<>c.plan_hash THEN RAISE EXCEPTION 'replay oracle changed' USING ERRCODE='42501'; END IF;
   next_state:=CASE p_data->>'outcome' WHEN 'PASS' THEN 'RESOLVED' WHEN 'REPRODUCIBLE_FAILURE' THEN 'REGRESSION_FAILED' ELSE 'INCONCLUSIVE' END;
  ELSIF (p_data->>'candidate')::boolean THEN
   INSERT INTO public.lg_findings(organization_id,project_id,invariant_id,invariant_version,signature,plan_hash,state)
    VALUES(r.organization_id,r.project_id,c.invariant_id,c.invariant_version,p_data->>'signature',c.plan_hash,'CANDIDATE') ON CONFLICT(organization_id,project_id,signature) DO NOTHING;
   SELECT * INTO f FROM public.lg_findings WHERE organization_id=r.organization_id AND project_id=r.project_id AND signature=p_data->>'signature' FOR UPDATE;
   INSERT INTO public.lg_finding_events(organization_id,project_id,finding_id,run_id,state) VALUES(r.organization_id,r.project_id,f.id,r.id,'CANDIDATE');
   IF ordinal=2 THEN INSERT INTO public.lg_finding_events(organization_id,project_id,finding_id,run_id,state) VALUES(r.organization_id,r.project_id,f.id,r.id,'REPRODUCING');END IF;
   next_state:=CASE WHEN p_data->>'outcome'='REPRODUCIBLE_FAILURE' THEN 'REPRODUCED' ELSE 'INCONCLUSIVE' END;
  END IF;
  IF f.id IS NOT NULL THEN
   IF c.replay_of IS NULL OR f.active_replay=r.id THEN UPDATE public.lg_findings SET state=next_state,updated_at=now() WHERE id=f.id;END IF;
   INSERT INTO public.lg_finding_events(organization_id,project_id,finding_id,run_id,state) VALUES(r.organization_id,r.project_id,f.id,r.id,CASE WHEN c.replay_of IS NOT NULL AND f.active_replay IS DISTINCT FROM r.id THEN 'SUPERSEDED' ELSE next_state END);
   INSERT INTO public.lg_finding_occurrences VALUES(r.organization_id,r.project_id,f.id,r.id,a.id,p_data->>'outcome');
   IF p_data->>'outcome'='REPRODUCIBLE_FAILURE' THEN
    INSERT INTO public.lg_regression_tests(organization_id,project_id,finding_id,artifact) VALUES(r.organization_id,r.project_id,f.id,jsonb_build_object('version',1,'originatingFinding',f.id,'plan',c.plan,'planHash',c.plan_hash,'expectedOutcome','PASS','oracle',c.plan#>'{spec,assertions}','originDeployment',r.deployment_id,'originRevision',r.commit_sha)) ON CONFLICT(finding_id) DO NOTHING;
   END IF;
  END IF;
  UPDATE public.lg_job_attempts SET state='COMPLETED',finished_at=now() WHERE id=a.id;UPDATE public.lg_jobs SET state='CLEANUP' WHERE id=a.job_id;
  PERFORM launchgate_private.run_event(r,'EVIDENCE_RECEIVED',a.id,a.worker_id);PERFORM launchgate_private.run_event(r,'ATTEMPT_COMPLETED',a.id,a.worker_id);
  RETURN jsonb_build_object('findingId',f.id,'outcome',p_data->>'outcome');
 END IF;
 result:=public.lg_execution_service_v4(p_action,p_data);
 IF p_action='CLAIM' AND result#>>'{run,purpose}'='REFERENCE_LAB' THEN
  SELECT * INTO c FROM public.lg_test_cases WHERE run_id=(result#>>'{run,id}')::uuid;SELECT * INTO t FROM public.lg_fixture_templates WHERE id=c.template_id;
  result:=result||jsonb_build_object('invariants',jsonb_build_array(jsonb_build_object('id',c.invariant_id,'version',c.invariant_version)),'referenceLab',jsonb_build_object('planHash',c.plan_hash,'caseId',c.plan->>'caseId','seed',c.seed,'variant',t.variant,'sourceDigest',t.source_digest));
 ELSIF p_action='CLEANUP_DONE' THEN
  SELECT v.* INTO r FROM public.lg_verification_runs v JOIN public.lg_job_attempts job_attempt ON job_attempt.run_id=v.id WHERE job_attempt.id=(p_data->>'attemptId')::uuid;
  IF r.purpose='REFERENCE_LAB' AND r.state='COMPLETED' THEN UPDATE public.lg_verification_runs SET result=(SELECT ar.result FROM public.lg_assertion_results ar WHERE ar.run_id=r.id) WHERE id=r.id;END IF;
 END IF;
 IF p_action IN ('RECOVER','CLEANUP_DONE') THEN
  -- Cancelled/dead-letter replays have no admitted result. They cannot resolve
  -- findings or leave the active finding indefinitely in FIX_VERIFICATION.
  FOR f IN SELECT finding.* FROM public.lg_findings finding JOIN public.lg_verification_runs v ON v.id=finding.active_replay WHERE finding.state<>'INCONCLUSIVE' AND v.state IN ('CANCELLED','FAILED_INFRASTRUCTURE') FOR UPDATE OF finding LOOP
   UPDATE public.lg_findings SET state='INCONCLUSIVE',updated_at=now() WHERE id=f.id;
   INSERT INTO public.lg_finding_events(organization_id,project_id,finding_id,run_id,state) VALUES(f.organization_id,f.project_id,f.id,f.active_replay,'INCONCLUSIVE');
  END LOOP;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION launchgate_private.execution_authorized(public.lg_verification_runs),launchgate_private.execution_authorized_v4(public.lg_verification_runs),launchgate_private.lab_create(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.lg_execution_service(text,jsonb),public.lg_finding_replay(uuid,uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_execution_service(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lg_finding_replay(uuid,uuid,text,uuid,uuid) TO authenticated;
COMMIT;
