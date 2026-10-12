BEGIN;
ALTER TABLE public.lg_audit_events DROP CONSTRAINT lg_audit_events_operation_check;
ALTER TABLE public.lg_audit_events ADD CONSTRAINT lg_audit_events_operation_check CHECK(operation IN ('ORGANIZATION_CREATED','MEMBER_ADDED','MEMBER_UPDATED','MEMBER_REMOVED','OWNERSHIP_TRANSFERRED','PROJECT_CREATED','RETENTION_UPDATED','DELETION_REQUESTED','GITHUB_SETUP_STARTED','GITHUB_CONNECTED','GITHUB_DISCONNECTED','SNAPSHOT_REQUESTED','INVARIANT_REVIEWED','EXECUTION_COMMAND'));
CREATE FUNCTION launchgate_private.run_event(r public.lg_verification_runs,k text,a uuid DEFAULT NULL,w uuid DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ INSERT INTO public.lg_run_events(organization_id,project_id,run_id,kind,attempt_id,worker_id) VALUES(r.organization_id,r.project_id,r.id,k,a,w) $$;

CREATE FUNCTION launchgate_private.execution_authorized(r public.lg_verification_runs) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.lg_target_authorizations a
 JOIN public.lg_authorization_proofs p ON p.id=a.proof_id
 JOIN public.lg_deployments d ON d.id=a.deployment_id
 JOIN public.lg_vercel_connections c ON c.id=d.connection_id
 JOIN public.lg_environments e ON e.id=d.environment_id
 JOIN public.lg_projects pr ON pr.id=r.project_id
 JOIN public.lg_organizations o ON o.id=r.organization_id
 JOIN public.lg_repository_snapshots s ON s.id=r.snapshot_id
 JOIN public.lg_repository_connections rc ON rc.id=d.repository_connection_id
 JOIN public.lg_installation_repositories ir ON ir.id=rc.repository_id
 JOIN public.lg_github_installations gi ON gi.id=ir.installation_id
 WHERE a.id=r.authorization_id AND a.version=r.authorization_version AND a.deployment_id=r.deployment_id
 AND a.revoked_at IS NULL AND a.starts_at<=clock_timestamp() AND a.expires_at>clock_timestamp()
 AND p.revoked_at IS NULL AND p.expires_at>clock_timestamp() AND c.status='ACTIVE' AND e.status='ACTIVE'
 AND o.status='ACTIVE' AND pr.status='ACTIVE' AND rc.status='ACTIVE' AND gi.status='ACTIVE'
 AND s.state='COMPLETE' AND s.connection_id=rc.id AND s.commit_sha=r.commit_sha AND d.commit_sha=r.commit_sha
 AND EXISTS(SELECT 1 FROM public.lg_organization_memberships WHERE organization_id=r.organization_id AND user_id=r.requested_by AND status='ACTIVE' AND role IN ('OWNER','ADMIN','DEVELOPER'))
 AND EXISTS(SELECT 1 FROM public.lg_organization_memberships WHERE organization_id=r.organization_id AND user_id=a.principal_id AND status='ACTIVE' AND role IN ('OWNER','ADMIN')))
$$;

CREATE FUNCTION public.lg_execution_command(p_project uuid,p_action text,p_data jsonb,p_correlation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;actor public.lg_organization_memberships;r public.lg_verification_runs;d public.lg_deployments;a public.lg_target_authorizations;
 proof public.lg_authorization_proofs;s public.lg_repository_snapshots;rid uuid;item jsonb;confirmation public.lg_invariant_confirmations;
BEGIN
 IF octet_length(p_data::text)>16384 THEN RAISE EXCEPTION 'invalid request' USING ERRCODE='22023'; END IF;
 SELECT organization_id INTO org FROM public.lg_projects WHERE id=p_project AND status='ACTIVE';
 actor:=launchgate_private.require_actor(org,CASE WHEN p_action IN ('RUN','CANCEL') THEN ARRAY['OWNER','ADMIN','DEVELOPER'] ELSE ARRAY['OWNER','ADMIN'] END);
 PERFORM launchgate_private.append_audit(org,actor,'EXECUTION_COMMAND','PROJECT',p_project,p_correlation);
 IF p_action='REVOKE_CONNECTION' THEN
  UPDATE public.lg_vercel_connections SET status='REVOKED' WHERE id=(p_data->>'connectionId')::uuid AND project_id=p_project;
  RETURN '{}'::jsonb;
 ELSIF p_action='ENVIRONMENT' THEN
  INSERT INTO public.lg_environments(organization_id,project_id,name,type) VALUES(org,p_project,p_data->>'name',p_data->>'type') RETURNING id INTO rid;
  RETURN jsonb_build_object('id',rid);
 ELSIF p_action='AUTHORIZE' THEN
  SELECT * INTO d FROM public.lg_deployments WHERE id=(p_data->>'deploymentId')::uuid AND project_id=p_project;
  SELECT * INTO proof FROM public.lg_authorization_proofs WHERE deployment_id=d.id AND revoked_at IS NULL AND expires_at>clock_timestamp() ORDER BY verified_at DESC LIMIT 1;
  IF proof.id IS NULL OR (p_data->>'expiresAt')::timestamptz>proof.expires_at THEN RAISE EXCEPTION 'proof required' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM public.lg_target_authorizations WHERE project_id=p_project AND request_key=(p_data->>'requestKey')::uuid;
  IF FOUND THEN
   IF a.deployment_id<>d.id OR a.expires_at<>(p_data->>'expiresAt')::timestamptz OR a.request_limit<>(p_data->>'requestLimit')::int OR a.concurrency_limit<>(p_data->>'concurrencyLimit')::int OR a.duration_seconds<>(p_data->>'durationSeconds')::int THEN RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('id',a.id,'version',a.version);
  END IF;
  INSERT INTO public.lg_target_authorizations(organization_id,project_id,deployment_id,proof_id,principal_id,principal_role,version,expires_at,request_limit,concurrency_limit,duration_seconds,request_key)
  VALUES(org,p_project,d.id,proof.id,auth.uid(),actor.role,(SELECT coalesce(max(version),0)+1 FROM public.lg_target_authorizations WHERE deployment_id=d.id),(p_data->>'expiresAt')::timestamptz,(p_data->>'requestLimit')::int,(p_data->>'concurrencyLimit')::int,(p_data->>'durationSeconds')::int,(p_data->>'requestKey')::uuid) RETURNING * INTO a;
  INSERT INTO public.lg_target_allowlists(organization_id,project_id,authorization_id,hostname) VALUES(org,p_project,a.id,split_part(d.target_url,'/',3));
  RETURN jsonb_build_object('id',a.id,'version',a.version);
 ELSIF p_action='REVOKE' THEN
  UPDATE public.lg_target_authorizations SET revoked_at=coalesce(revoked_at,now()) WHERE id=(p_data->>'authorizationId')::uuid AND project_id=p_project;
  FOR r IN SELECT * FROM public.lg_verification_runs WHERE authorization_id=(p_data->>'authorizationId')::uuid AND project_id=p_project AND state IN ('QUEUED','PREPARING','RUNNING') LOOP
   UPDATE public.lg_verification_runs SET state='CANCELLING',updated_at=now() WHERE id=r.id;
   PERFORM launchgate_private.run_event(r,'AUTHORIZATION_REVOKED');
  END LOOP;
  RETURN '{}'::jsonb;
 ELSIF p_action='RUN' THEN
  SELECT * INTO r FROM public.lg_verification_runs WHERE project_id=p_project AND request_key=(p_data->>'requestKey')::uuid;
  IF FOUND THEN
   IF r.input_digest<>md5(p_data::text) THEN RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('id',r.id);
  END IF;
  SELECT * INTO a FROM public.lg_target_authorizations WHERE id=(p_data->>'authorizationId')::uuid AND project_id=p_project;
  SELECT * INTO d FROM public.lg_deployments WHERE id=a.deployment_id;
  SELECT * INTO s FROM public.lg_repository_snapshots WHERE id=(p_data->>'snapshotId')::uuid AND project_id=p_project;
  INSERT INTO public.lg_verification_runs(organization_id,project_id,snapshot_id,deployment_id,authorization_id,authorization_version,commit_sha,policy_version,requested_by,request_key,input_digest)
  VALUES(org,p_project,s.id,d.id,a.id,a.version,s.commit_sha,1,auth.uid(),(p_data->>'requestKey')::uuid,md5(p_data::text)) RETURNING * INTO r;
  IF NOT launchgate_private.execution_authorized(r) THEN RAISE EXCEPTION 'authorization required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_data->'invariants') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'invariants')>30 THEN RAISE EXCEPTION 'invalid invariants' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_data->'invariants') LOOP
   SELECT c.* INTO confirmation FROM public.lg_invariant_confirmations c JOIN public.lg_invariant_proposals p ON p.id=c.proposal_id
    WHERE c.proposal_id=(item->>'id')::uuid AND c.version=(item->>'version')::int AND c.project_id=p_project AND p.snapshot_id=s.id AND c.action IN ('CONFIRM','REFINE')
    AND c.version=(SELECT max(version) FROM public.lg_invariant_confirmations WHERE proposal_id=c.proposal_id);
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid invariant' USING ERRCODE='42501'; END IF;
   INSERT INTO public.lg_run_invariants VALUES(org,p_project,r.id,confirmation.proposal_id,confirmation.version,confirmation.statement);
  END LOOP;
  INSERT INTO public.lg_jobs(organization_id,project_id,run_id) VALUES(org,p_project,r.id);
  PERFORM launchgate_private.run_event(r,'RUN_CREATED');PERFORM launchgate_private.run_event(r,'JOB_QUEUED');
  RETURN jsonb_build_object('id',r.id);
 ELSIF p_action='CANCEL' THEN
  SELECT * INTO r FROM public.lg_verification_runs WHERE id=(p_data->>'runId')::uuid AND project_id=p_project;
  IF r.id IS NULL THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
  IF r.state IN ('QUEUED','PREPARING','RUNNING') THEN
   UPDATE public.lg_verification_runs SET state='CANCELLING',updated_at=now() WHERE id=r.id;
   PERFORM launchgate_private.run_event(r,'CANCELLATION_REQUESTED');
  END IF;
  RETURN jsonb_build_object('id',r.id);
 END IF;
 RAISE EXCEPTION 'invalid command' USING ERRCODE='22023';
END $$;

-- All commands lock organization before job/attempt rows. No privileged table
-- grants, and browser JWTs cannot execute this worker gateway.
CREATE FUNCTION public.lg_execution_service(p_action text,p_data jsonb) RETURNS jsonb
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
   WHERE (p_action='CLAIM' AND q.state='READY' AND q.available_at<=now()) OR
    (p_action='RECOVER' AND q.state IN ('READY','LEASED') AND (x.expires_at<=now() OR t.deadline<=now() OR EXISTS(SELECT 1 FROM public.lg_verification_runs v WHERE v.id=q.run_id AND (v.state='CANCELLING' OR NOT launchgate_private.execution_authorized(v))))) OR
    (p_action='CLEANUP_CLAIM' AND q.state='CLEANUP' AND (x.cleanup_expires_at IS NULL OR x.cleanup_expires_at<now())) ORDER BY q.available_at LIMIT 1;
  IF org IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.lg_organizations WHERE id=org FOR UPDATE;
  FOR j IN SELECT * FROM public.lg_jobs WHERE organization_id=org AND state IN ('READY','LEASED','CLEANUP') ORDER BY available_at FOR UPDATE LOOP
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
REVOKE ALL ON FUNCTION launchgate_private.run_event(public.lg_verification_runs,text,uuid,uuid),launchgate_private.execution_authorized(public.lg_verification_runs) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.lg_execution_command(uuid,text,jsonb,uuid),public.lg_execution_service(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_execution_command(uuid,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lg_execution_service(text,jsonb) TO service_role;
COMMIT;
