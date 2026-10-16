BEGIN;
-- Preserve the Phase 4/8 commands while adding dispatch affinity. Ordinary
-- workers cannot claim a patched preview; its owning worker cannot claim a
-- customer or another remediation's execution/cleanup job.
CREATE FUNCTION launchgate_private.fix_job_scope(p_run uuid,p_release text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_release IS NULL THEN NOT EXISTS(SELECT 1 FROM public.lg_release_runs rr JOIN public.lg_fix_verification_runs fv ON fv.release_id=rr.release_id WHERE rr.run_id=p_run)
 ELSE EXISTS(SELECT 1 FROM public.lg_release_runs rr JOIN public.lg_fix_verification_runs fv ON fv.release_id=rr.release_id WHERE rr.run_id=p_run AND rr.release_id=p_release::uuid) END
$$;
REVOKE ALL ON FUNCTION launchgate_private.fix_job_scope(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.lg_execution_service_v4(p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;r public.lg_verification_runs;j public.lg_jobs;a public.lg_job_attempts;l public.lg_runner_leases;
 authz public.lg_target_authorizations;d public.lg_deployments;b public.lg_execution_budgets;item jsonb;rid uuid;used integer;busy integer;
BEGIN
 IF octet_length(p_data::text)>131072 THEN RAISE EXCEPTION 'payload limit' USING ERRCODE='22023'; END IF;
 IF p_action='CONNECT' THEN
  SELECT organization_id INTO org FROM public.lg_projects WHERE id=(p_data->>'projectId')::uuid AND status='ACTIVE';
  PERFORM launchgate_private.source_actor(org,(p_data->>'actorId')::uuid,ARRAY['OWNER','ADMIN']);
  INSERT INTO public.lg_vercel_connections(organization_id,project_id,account_id,provider_project_id,credential_reference)
   VALUES(org,(p_data->>'projectId')::uuid,p_data->>'accountId',p_data->>'providerProjectId',(p_data->>'credentialReference')::uuid)
   ON CONFLICT(account_id,provider_project_id) DO NOTHING RETURNING id INTO rid;
  IF rid IS NULL THEN
   SELECT id INTO rid FROM public.lg_vercel_connections WHERE account_id=p_data->>'accountId' AND provider_project_id=p_data->>'providerProjectId' AND organization_id=org AND project_id=(p_data->>'projectId')::uuid AND status='ACTIVE' AND credential_reference=(p_data->>'credentialReference')::uuid;
   IF rid IS NULL THEN RAISE EXCEPTION 'provider connection denied' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN jsonb_build_object('id',rid);
 ELSIF p_action='DEPLOYMENT' THEN
  SELECT organization_id INTO org FROM public.lg_projects WHERE id=(p_data->>'projectId')::uuid AND status='ACTIVE';
  PERFORM launchgate_private.source_actor(org,(p_data->>'actorId')::uuid,ARRAY['OWNER','ADMIN']);
  PERFORM 1 FROM public.lg_vercel_connections WHERE id=(p_data->>'connectionId')::uuid AND project_id=(p_data->>'projectId')::uuid AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'connection revoked' USING ERRCODE='42501'; END IF;
  INSERT INTO public.lg_deployments(organization_id,project_id,environment_id,connection_id,repository_connection_id,provider,provider_deployment_id,target_url,commit_sha,verification_state)
  VALUES(org,(p_data->>'projectId')::uuid,(p_data->>'environmentId')::uuid,(p_data->>'connectionId')::uuid,(p_data->>'repositoryConnectionId')::uuid,'VERCEL',p_data->>'providerDeploymentId',p_data->>'targetUrl',p_data->>'commitSha','PROVIDER_VERIFIED')
  ON CONFLICT(connection_id,provider_deployment_id) DO NOTHING RETURNING * INTO d;
  IF d.id IS NULL THEN
   SELECT * INTO d FROM public.lg_deployments WHERE connection_id=(p_data->>'connectionId')::uuid AND provider_deployment_id=p_data->>'providerDeploymentId';
   IF d.commit_sha<>p_data->>'commitSha' OR d.target_url<>p_data->>'targetUrl' OR d.environment_id<>(p_data->>'environmentId')::uuid OR d.repository_connection_id<>(p_data->>'repositoryConnectionId')::uuid THEN RAISE EXCEPTION 'deployment changed' USING ERRCODE='22023'; END IF;
  END IF;
  INSERT INTO public.lg_authorization_proofs(organization_id,project_id,deployment_id,method,digest,expires_at) VALUES(org,d.project_id,d.id,'PROVIDER_OWNERSHIP_VERIFICATION',p_data->>'proofDigest',now()+interval '1 hour');
  RETURN to_jsonb(d);
 ELSIF p_action='CONTEXT' THEN
  SELECT organization_id INTO org FROM public.lg_projects WHERE id=(p_data->>'projectId')::uuid AND status='ACTIVE';
  PERFORM launchgate_private.source_actor(org,(p_data->>'actorId')::uuid,ARRAY['OWNER','ADMIN']);
  RETURN (SELECT to_jsonb(c) FROM public.lg_vercel_connections c WHERE c.project_id=(p_data->>'projectId')::uuid AND c.id=(p_data->>'connectionId')::uuid AND c.status='ACTIVE');
 ELSIF p_action IN ('CLAIM','RECOVER','CLEANUP_CLAIM') THEN
  -- Select a single org first, then recheck under its shared command lock.
  SELECT q.organization_id INTO org FROM public.lg_jobs q LEFT JOIN public.lg_job_attempts t ON t.job_id=q.id AND t.fence=q.fence LEFT JOIN public.lg_runner_leases x ON x.attempt_id=t.id
   WHERE launchgate_private.fix_job_scope(q.run_id,p_data->>'remediationReleaseId') AND ((p_action='CLAIM' AND q.state='READY' AND q.available_at<=now()) OR
    (p_action='RECOVER' AND q.state IN ('READY','LEASED') AND (x.expires_at<=now() OR t.deadline<=now() OR EXISTS(SELECT 1 FROM public.lg_verification_runs v WHERE v.id=q.run_id AND (v.state='CANCELLING' OR NOT launchgate_private.execution_authorized(v))))) OR
    (p_action='CLEANUP_CLAIM' AND q.state='CLEANUP' AND (x.cleanup_expires_at IS NULL OR x.cleanup_expires_at<now()))) ORDER BY q.available_at LIMIT 1;
  IF org IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.lg_organizations WHERE id=org FOR UPDATE;
  FOR j IN SELECT * FROM public.lg_jobs WHERE organization_id=org AND launchgate_private.fix_job_scope(run_id,p_data->>'remediationReleaseId') AND state IN ('READY','LEASED','CLEANUP') ORDER BY available_at FOR UPDATE LOOP
   SELECT * INTO r FROM public.lg_verification_runs WHERE id=j.run_id;
   SELECT * INTO a FROM public.lg_job_attempts WHERE job_id=j.id AND fence=j.fence;
   SELECT * INTO l FROM public.lg_runner_leases WHERE attempt_id=a.id;
   IF p_action='RECOVER' THEN
    IF r.state='CANCELLING' OR NOT launchgate_private.execution_authorized(r) OR (j.state='LEASED' AND (l.expires_at<=now() OR a.deadline<=now())) THEN
     IF j.state='READY' THEN
      UPDATE public.lg_jobs SET state='CANCELLED' WHERE id=j.id;
      UPDATE public.lg_verification_runs SET state='CANCELLED',updated_at=now() WHERE id=r.id;
     ELSIF j.state='LEASED' THEN
      UPDATE public.lg_jobs SET state='CLEANUP' WHERE id=j.id;
      UPDATE public.lg_job_attempts SET state=CASE WHEN r.state='CANCELLING' OR NOT launchgate_private.execution_authorized(r) THEN 'CANCELLED' ELSE 'FAILED' END,finished_at=now() WHERE id=a.id;
      UPDATE public.lg_runner_leases SET expires_at=now() WHERE attempt_id=a.id;
     END IF;
    END IF;
   ELSIF p_action='CLEANUP_CLAIM' AND j.state='CLEANUP' AND (l.cleanup_expires_at IS NULL OR l.cleanup_expires_at<=now()) THEN
    UPDATE public.lg_runner_leases SET cleanup_worker=(p_data->>'workerId')::uuid,cleanup_expires_at=now()+interval '30 seconds' WHERE attempt_id=a.id;
    UPDATE public.lg_job_attempts SET cleanup_state='RUNNING' WHERE id=a.id;
    PERFORM launchgate_private.run_event(r,'CLEANUP_STARTED',a.id,(p_data->>'workerId')::uuid);
    RETURN jsonb_build_object('attempt',to_jsonb(a),'run',to_jsonb(r));
   ELSIF p_action='CLAIM' AND j.state='READY' AND j.available_at<=now() AND j.attempt_count<3 AND launchgate_private.execution_authorized(r) AND r.state IN ('QUEUED','PREPARING') THEN
    SELECT * INTO authz FROM public.lg_target_authorizations WHERE id=r.authorization_id;
    INSERT INTO public.lg_execution_budgets(organization_id) VALUES(org) ON CONFLICT DO NOTHING;
    UPDATE public.lg_execution_budgets SET consumed=0,window_start=now() WHERE organization_id=org AND active=0 AND window_start<=now()-interval '24 hours';
    SELECT * INTO b FROM public.lg_execution_budgets WHERE organization_id=org;
    SELECT coalesce(sum(t.requests),0),coalesce(sum(CASE WHEN t.cleanup_state<>'COMPLETED' THEN t.reserved_concurrency ELSE 0 END),0) INTO used,busy FROM public.lg_job_attempts t JOIN public.lg_verification_runs v ON v.id=t.run_id WHERE v.authorization_id=authz.id;
    IF b.consumed+b.reserved+(authz.request_limit-used)>b.request_limit OR b.active+authz.concurrency_limit>b.concurrency_limit OR used>=authz.request_limit OR busy>0 THEN
     UPDATE public.lg_jobs SET available_at=now()+interval '1 second' WHERE id=j.id;CONTINUE;
    END IF;
    UPDATE public.lg_execution_budgets SET reserved=reserved+(authz.request_limit-used),active=active+authz.concurrency_limit WHERE organization_id=org;
    UPDATE public.lg_jobs SET state='LEASED',fence=fence+1,attempt_count=attempt_count+1 WHERE id=j.id RETURNING * INTO j;
    INSERT INTO public.lg_job_attempts(organization_id,project_id,job_id,run_id,fence,worker_id,runner_id,grant_id,reserved_requests,reserved_concurrency,deadline)
     VALUES(org,r.project_id,j.id,r.id,j.fence,(p_data->>'workerId')::uuid,gen_random_uuid(),gen_random_uuid(),authz.request_limit-used,authz.concurrency_limit,least(now()+make_interval(secs=>authz.duration_seconds),authz.expires_at)) RETURNING * INTO a;
    INSERT INTO public.lg_runner_leases(organization_id,project_id,attempt_id,fence,expires_at) VALUES(org,r.project_id,a.id,j.fence,least(now()+interval '10 seconds',a.deadline));
    UPDATE public.lg_verification_runs SET state='PREPARING',updated_at=now() WHERE id=r.id;
    PERFORM launchgate_private.run_event(r,'AUTHORIZATION_VALIDATED',a.id,a.worker_id);PERFORM launchgate_private.run_event(r,'BUDGET_RESERVED',a.id,a.worker_id);PERFORM launchgate_private.run_event(r,'LEASE_ACQUIRED',a.id,a.worker_id);
    SELECT * INTO d FROM public.lg_deployments WHERE id=r.deployment_id;
    RETURN jsonb_build_object('run',to_jsonb(r),'job',to_jsonb(j),'attempt',to_jsonb(a),'authorization',to_jsonb(authz),'deployment',to_jsonb(d),'invariants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',invariant_id,'version',version)) FROM public.lg_run_invariants WHERE run_id=r.id),'[]'::jsonb));
   END IF;
  END LOOP;
  RETURN NULL;
 END IF;
 SELECT organization_id INTO org FROM public.lg_job_attempts WHERE id=(p_data->>'attemptId')::uuid;
 PERFORM 1 FROM public.lg_organizations WHERE id=org FOR UPDATE;
 SELECT * INTO a FROM public.lg_job_attempts WHERE id=(p_data->>'attemptId')::uuid FOR UPDATE;
 SELECT * INTO j FROM public.lg_jobs WHERE id=a.job_id FOR UPDATE;
 SELECT * INTO r FROM public.lg_verification_runs WHERE id=a.run_id;
 SELECT * INTO l FROM public.lg_runner_leases WHERE attempt_id=a.id FOR UPDATE;
 IF a.id IS NULL OR a.fence IS DISTINCT FROM (p_data->>'fence')::bigint OR j.fence<>a.fence THEN RAISE EXCEPTION 'fencing lost' USING ERRCODE='42501'; END IF;
 IF p_action='CLEANUP_DONE' THEN
  IF j.state<>'CLEANUP' OR l.cleanup_worker IS DISTINCT FROM (p_data->>'workerId')::uuid OR l.cleanup_expires_at<=now() THEN RAISE EXCEPTION 'cleanup lease lost' USING ERRCODE='42501'; END IF;
  UPDATE public.lg_job_attempts SET cleanup_state='COMPLETED' WHERE id=a.id;
  UPDATE public.lg_execution_budgets SET reserved=reserved-a.reserved_requests,consumed=consumed+a.requests,active=active-a.reserved_concurrency WHERE organization_id=org;
  IF r.state='CANCELLING' OR NOT launchgate_private.execution_authorized(r) OR a.state='CANCELLED' THEN
   UPDATE public.lg_jobs SET state='CANCELLED' WHERE id=j.id;UPDATE public.lg_verification_runs SET state='CANCELLED',updated_at=now() WHERE id=r.id;
  ELSIF a.state='COMPLETED' THEN
   UPDATE public.lg_jobs SET state='DONE' WHERE id=j.id;UPDATE public.lg_verification_runs SET state='COMPLETED',result='UNOBSERVABLE',updated_at=now() WHERE id=r.id;
  ELSIF j.attempt_count>=3 THEN
   UPDATE public.lg_jobs SET state='DEAD' WHERE id=j.id;UPDATE public.lg_verification_runs SET state='FAILED_INFRASTRUCTURE',updated_at=now() WHERE id=r.id;
  ELSE
   UPDATE public.lg_jobs SET state='READY',available_at=now()+make_interval(secs=>power(2,j.attempt_count)::int) WHERE id=j.id;UPDATE public.lg_verification_runs SET state='PREPARING',updated_at=now() WHERE id=r.id;
  END IF;
  PERFORM launchgate_private.run_event(r,'RUNNER_TERMINATED',a.id,(p_data->>'workerId')::uuid);PERFORM launchgate_private.run_event(r,'CLEANUP_COMPLETED',a.id,(p_data->>'workerId')::uuid);
  RETURN '{}'::jsonb;
 END IF;
 IF p_data->>'grantId' IS DISTINCT FROM a.grant_id::text OR p_data->>'runnerId' IS DISTINCT FROM a.runner_id::text THEN RAISE EXCEPTION 'runner denied' USING ERRCODE='42501'; END IF;
 IF p_action IN ('CHECK','COMPLETE') AND a.state='COMPLETED' AND r.state NOT IN ('CANCELLING','CANCELLED') AND launchgate_private.execution_authorized(r) THEN
  IF p_action='CHECK' THEN RETURN jsonb_build_object('complete',true); END IF;
  IF EXISTS(SELECT 1 FROM public.lg_evidence_manifests WHERE attempt_id=a.id AND digest=p_data->>'digest') THEN RETURN jsonb_build_object('duplicate',true); END IF;
  RAISE EXCEPTION 'completion conflict' USING ERRCODE='22023';
 END IF;
 IF j.state<>'LEASED' OR l.expires_at<=clock_timestamp() OR a.deadline<=clock_timestamp() OR r.state NOT IN ('PREPARING','RUNNING') OR NOT launchgate_private.execution_authorized(r) THEN RAISE EXCEPTION 'execution stopped' USING ERRCODE='42501'; END IF;
 IF p_data->>'grantId' IS DISTINCT FROM a.grant_id::text OR p_data->>'runnerId' IS DISTINCT FROM a.runner_id::text THEN RAISE EXCEPTION 'runner denied' USING ERRCODE='42501'; END IF;
 IF p_action='START' THEN
  IF l.grant_consumed_at IS NOT NULL THEN RAISE EXCEPTION 'grant replay' USING ERRCODE='42501'; END IF;
  UPDATE public.lg_runner_leases SET grant_consumed_at=now() WHERE attempt_id=a.id;
  UPDATE public.lg_job_attempts SET state='RUNNING' WHERE id=a.id;UPDATE public.lg_verification_runs SET state='RUNNING',updated_at=now() WHERE id=r.id;
  PERFORM launchgate_private.run_event(r,'RUNNER_STARTED',a.id,a.worker_id);
 ELSIF p_action IN ('CHECK','REQUEST') THEN
  IF l.grant_consumed_at IS NULL THEN RAISE EXCEPTION 'grant not started' USING ERRCODE='42501'; END IF;
  UPDATE public.lg_runner_leases SET expires_at=least(now()+interval '10 seconds',a.deadline) WHERE attempt_id=a.id;
  IF p_action='REQUEST' THEN
   IF a.requests>=a.reserved_requests OR a.next_request_at>clock_timestamp() THEN RAISE EXCEPTION 'request budget' USING ERRCODE='42501'; END IF;
   UPDATE public.lg_job_attempts SET requests=requests+1,next_request_at=clock_timestamp()+interval '500 milliseconds' WHERE id=a.id;PERFORM launchgate_private.run_event(r,'TARGET_REQUEST_STARTED',a.id,a.worker_id);
  END IF;
 ELSIF p_action='FAIL' THEN
  UPDATE public.lg_job_attempts SET state='FAILED',finished_at=now() WHERE id=a.id;UPDATE public.lg_jobs SET state='CLEANUP' WHERE id=j.id;
 ELSIF p_action='COMPLETE' THEN
  IF l.grant_consumed_at IS NULL OR (p_data->>'requests')::int IS DISTINCT FROM a.requests OR
   NOT (p_data->'manifest' @> jsonb_build_object('runId',r.id,'attemptId',a.id,'commitSha',r.commit_sha,'deploymentId',r.deployment_id,'authorizationId',r.authorization_id,'authorizationVersion',r.authorization_version,'fence',a.fence,'runnerId',a.runner_id)) THEN RAISE EXCEPTION 'invalid evidence binding' USING ERRCODE='42501'; END IF;
  INSERT INTO public.lg_evidence_manifests(organization_id,project_id,run_id,attempt_id,digest,manifest) VALUES(org,r.project_id,r.id,a.id,p_data->>'digest',p_data->'manifest');
  FOR item IN SELECT * FROM jsonb_array_elements(p_data->'artifacts') LOOP
   INSERT INTO public.lg_artifacts VALUES((item->>'id')::uuid,org,r.project_id,r.id,a.id,'PROBE_METADATA',item->>'hash',(item->>'size')::int,'INTERNAL','NO_SENSITIVE_DATA',item->>'reference',now()+interval '7 days');
  END LOOP;
  INSERT INTO public.lg_observations VALUES(org,r.project_id,a.id,p_data->'observations');
  INSERT INTO public.lg_assertion_results SELECT org,r.project_id,r.id,invariant_id,'UNOBSERVABLE' FROM public.lg_run_invariants WHERE run_id=r.id;
  UPDATE public.lg_job_attempts SET state='COMPLETED',finished_at=now() WHERE id=a.id;UPDATE public.lg_jobs SET state='CLEANUP' WHERE id=j.id;
  PERFORM launchgate_private.run_event(r,'EVIDENCE_RECEIVED',a.id,a.worker_id);PERFORM launchgate_private.run_event(r,'ATTEMPT_COMPLETED',a.id,a.worker_id);
 ELSE RAISE EXCEPTION 'invalid command' USING ERRCODE='22023';
 END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.lg_release_service_v8(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  SELECT s.* INTO st FROM public.lg_release_states s JOIN public.lg_release_candidates c ON c.id=s.release_id WHERE (CASE WHEN p_data->>'remediationReleaseId' IS NULL THEN NOT EXISTS(SELECT 1 FROM public.lg_fix_verification_runs fv WHERE fv.release_id=s.release_id) ELSE s.release_id=(p_data->>'remediationReleaseId')::uuid AND EXISTS(SELECT 1 FROM public.lg_fix_verification_runs fv WHERE fv.release_id=s.release_id) END) AND s.state IN ('READY','VERIFYING','EVALUATING','DECIDED') AND
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
COMMIT;
