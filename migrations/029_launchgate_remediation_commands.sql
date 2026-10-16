BEGIN;
CREATE FUNCTION launchgate_private.fix_event(p public.lg_fix_proposals,k text,actor uuid,rkey uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member public.lg_organization_memberships;BEGIN
 member:=launchgate_private.source_actor(p.organization_id,actor,ARRAY['OWNER','ADMIN']);
 INSERT INTO public.lg_fix_events(organization_id,project_id,proposal_id,actor_id,kind,request_key) VALUES(p.organization_id,p.project_id,p.id,actor,k,rkey) ON CONFLICT DO NOTHING;
 PERFORM launchgate_private.append_audit(p.organization_id,member,'EXECUTION_COMMAND','PROJECT',p.project_id,gen_random_uuid());
END $$;
CREATE FUNCTION public.lg_fix_command(p_project uuid,p_action text,p_data jsonb,p_correlation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;member public.lg_organization_memberships;p public.lg_fix_proposals;f public.lg_findings;r public.lg_verification_runs;key uuid;
BEGIN
 SELECT organization_id INTO org FROM public.lg_projects WHERE id=p_project AND status='ACTIVE';
 member:=launchgate_private.require_actor(org,ARRAY['OWNER','ADMIN']);key:=(p_data->>'requestKey')::uuid;
 IF key IS NULL OR p_data IS NULL OR octet_length(p_data::text)>4096 THEN RAISE EXCEPTION 'request limit' USING ERRCODE='22023';END IF;
 IF p_action='REQUEST' THEN
  SELECT * INTO p FROM public.lg_fix_proposals WHERE project_id=p_project AND request_key=key;
  IF FOUND THEN
   IF p.finding_id IS DISTINCT FROM (p_data->>'findingId')::uuid OR p.policy_id IS DISTINCT FROM (p_data->>'policyId')::uuid OR p.policy_version IS DISTINCT FROM (p_data->>'policyVersion')::int THEN RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='22023';END IF;RETURN to_jsonb(p);
  END IF;
  SELECT * INTO f FROM public.lg_findings WHERE id=(p_data->>'findingId')::uuid AND organization_id=org AND project_id=p_project FOR UPDATE;
  IF f.id IS NULL OR f.state NOT IN ('REPRODUCED','REGRESSION_FAILED') OR NOT EXISTS(SELECT 1 FROM public.lg_regression_tests WHERE finding_id=f.id) THEN RAISE EXCEPTION 'reproduced finding required' USING ERRCODE='42501';END IF;
  SELECT vr.* INTO r FROM public.lg_finding_occurrences fo JOIN public.lg_verification_runs vr ON vr.id=fo.run_id WHERE fo.finding_id=f.id AND fo.outcome='REPRODUCIBLE_FAILURE' AND vr.state='COMPLETED' ORDER BY vr.created_at DESC LIMIT 1;
  IF r.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.lg_policy_invariants WHERE organization_id=org AND project_id=p_project AND policy_id=(p_data->>'policyId')::uuid AND policy_version=(p_data->>'policyVersion')::int AND invariant_id=f.invariant_id AND requirement->>'planHash'=f.plan_hash AND requirement->>'required'='true') THEN RAISE EXCEPTION 'required original regression policy' USING ERRCODE='42501';END IF;
  INSERT INTO public.lg_fix_proposals(organization_id,project_id,finding_id,origin_run_id,source_sha,policy_id,policy_version,mode,requested_by,request_key,next_action)
   VALUES(org,p_project,f.id,r.id,r.commit_sha,(p_data->>'policyId')::uuid,(p_data->>'policyVersion')::int,CASE WHEN r.purpose='REFERENCE_LAB' THEN 'REFERENCE_LAB' ELSE 'GITHUB' END,auth.uid(),key,'GENERATE') RETURNING * INTO p;
  PERFORM launchgate_private.fix_event(p,'FIX_REQUESTED',auth.uid(),key);RETURN to_jsonb(p);
 END IF;
 SELECT * INTO p FROM public.lg_fix_proposals WHERE id=(p_data->>'proposalId')::uuid AND organization_id=org AND project_id=p_project FOR UPDATE;
 IF p.id IS NULL THEN RAISE EXCEPTION 'proposal access' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM launchgate_private.fix_requests WHERE proposal_id=p.id AND action=p_action AND request_key=key) THEN RETURN to_jsonb(p);END IF;
 IF p.next_action IS NOT NULL OR EXISTS(SELECT 1 FROM launchgate_private.fix_leases WHERE proposal_id=p.id AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'proposal busy' USING ERRCODE='55000';END IF;
 IF NOT ((p_action='VALIDATE' AND p.state='PROPOSED') OR (p_action='PR' AND p.state='READY_FOR_PR') OR (p_action='VERIFY' AND p.state='PR_CREATED')) THEN RAISE EXCEPTION 'proposal transition' USING ERRCODE='42501';END IF;
 IF p_action='PR' AND p.mode='GITHUB' AND NOT EXISTS(SELECT 1 FROM public.lg_remediation_capabilities c JOIN public.lg_verification_runs vr ON vr.id=p.origin_run_id JOIN public.lg_deployments d ON d.id=vr.deployment_id WHERE c.project_id=p_project AND c.connection_id=d.repository_connection_id AND c.enabled AND c.revoked_at IS NULL AND c.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'write capability required' USING ERRCODE='42501';END IF;
 INSERT INTO launchgate_private.fix_requests VALUES(p.id,p_action,key,auth.uid(),now());
 UPDATE public.lg_fix_proposals SET next_action=p_action,updated_at=now() WHERE id=p.id;
 PERFORM launchgate_private.fix_event(p,CASE p_action WHEN 'PR' THEN 'PR_REQUESTED' WHEN 'VERIFY' THEN 'VERIFICATION_REQUESTED' ELSE 'VALIDATION_REQUESTED' END,auth.uid(),key);
 RETURN to_jsonb(p);
END $$;
CREATE FUNCTION public.lg_fix_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.lg_fix_proposals;l launchgate_private.fix_leases;f public.lg_findings;art public.lg_patch_artifacts;pr public.lg_fix_pull_requests;
 r public.lg_verification_runs;b public.lg_reproduction_bundles;a public.lg_target_authorizations;proof public.lg_authorization_proofs;
 fv public.lg_fix_verification_runs;rc public.lg_release_candidates;ge public.lg_gate_evaluations;next_state text;worker uuid;result jsonb;actor uuid;
BEGIN
 IF p_data IS NULL OR octet_length(p_data::text)>2097152 THEN RAISE EXCEPTION 'payload limit';END IF;
 worker:=(p_data->>'workerId')::uuid;
 IF p_action='CLAIM' THEN
  IF worker IS NULL THEN RAISE EXCEPTION 'worker required';END IF;
  SELECT q.* INTO p FROM public.lg_fix_proposals q WHERE q.next_action IS NOT NULL AND NOT EXISTS(SELECT 1 FROM launchgate_private.fix_leases fl WHERE fl.proposal_id=q.id AND fl.expires_at>clock_timestamp()) ORDER BY q.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF p.id IS NULL THEN RETURN NULL;END IF;
  INSERT INTO launchgate_private.fix_leases VALUES(p.id,worker,1,clock_timestamp()+interval '60 seconds') ON CONFLICT(proposal_id) DO UPDATE SET worker_id=worker,fence=fix_leases.fence+1,expires_at=clock_timestamp()+interval '60 seconds' RETURNING * INTO l;
  RETURN jsonb_build_object('proposalId',p.id,'fence',l.fence,'workerId',worker);
 END IF;
 SELECT * INTO p FROM public.lg_fix_proposals WHERE id=(p_data->>'proposalId')::uuid FOR UPDATE;
 SELECT * INTO l FROM launchgate_private.fix_leases WHERE proposal_id=p.id FOR UPDATE;
 IF p.id IS NULL OR l.worker_id IS DISTINCT FROM worker OR l.fence IS DISTINCT FROM (p_data->>'fence')::bigint OR l.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'fix lease' USING ERRCODE='42501';END IF;
 PERFORM launchgate_private.source_actor(p.organization_id,p.requested_by,ARRAY['OWNER','ADMIN']);
 UPDATE launchgate_private.fix_leases SET expires_at=clock_timestamp()+interval '60 seconds' WHERE proposal_id=p.id;
 IF p_action='CHECK' THEN RETURN '{}'::jsonb;
 ELSIF p_action='RELEASE' THEN DELETE FROM launchgate_private.fix_leases WHERE proposal_id=p.id;RETURN '{}'::jsonb;
 ELSIF p_action='LOAD' THEN
  SELECT * INTO f FROM public.lg_findings WHERE id=p.finding_id;SELECT * INTO r FROM public.lg_verification_runs WHERE id=p.origin_run_id;
  SELECT * INTO b FROM public.lg_reproduction_bundles WHERE run_id=r.id;SELECT * INTO a FROM public.lg_target_authorizations WHERE id=r.authorization_id;SELECT * INTO proof FROM public.lg_authorization_proofs WHERE id=a.proof_id;
  SELECT * INTO art FROM public.lg_patch_artifacts WHERE proposal_id=p.id;SELECT * INTO pr FROM public.lg_fix_pull_requests WHERE proposal_id=p.id;SELECT * INTO fv FROM public.lg_fix_verification_runs WHERE proposal_id=p.id;
  RETURN jsonb_build_object('request',to_jsonb(p),'finding',to_jsonb(f),'original',jsonb_build_object('invariantId',f.invariant_id,'run',to_jsonb(r),'authorization',to_jsonb(a),'proof',to_jsonb(proof),'bundle',b.bundle,'manifestDigest',b.manifest_digest),'artifact',CASE WHEN art.proposal_id IS NULL THEN NULL ELSE to_jsonb(art) END,'pullRequest',CASE WHEN pr.proposal_id IS NULL THEN NULL ELSE to_jsonb(pr) END,'verification',CASE WHEN fv.proposal_id IS NULL THEN NULL ELSE to_jsonb(fv) END,'policy',(SELECT policy FROM public.lg_policy_versions WHERE policy_id=p.policy_id AND version=p.policy_version));
 ELSIF p_action='GENERATED' AND p.next_action='GENERATE' AND p.state='PROPOSAL_REQUESTED' THEN
  IF p_data#>>'{proposal,id}' IS DISTINCT FROM p.id::text OR p_data#>>'{proposal,findingId}' IS DISTINCT FROM p.finding_id::text OR p_data#>>'{proposal,sourceSha}' IS DISTINCT FROM p.source_sha OR p_data#>>'{context,organizationId}' IS DISTINCT FROM p.organization_id::text OR p_data#>>'{context,projectId}' IS DISTINCT FROM p.project_id::text THEN RAISE EXCEPTION 'proposal binding';END IF;
  INSERT INTO public.lg_patch_artifacts(proposal_id,organization_id,project_id,context,proposal,patch_hash) VALUES(p.id,p.organization_id,p.project_id,p_data->'context',p_data->'proposal',p_data->>'patchHash');next_state:='PROPOSED';
 ELSIF p_action='VALIDATED' AND p.next_action='VALIDATE' AND p.state='PROPOSED' THEN next_state:='READY_FOR_PR';
 ELSIF p_action='PR_CREATED' AND p.next_action='PR' AND p.state='READY_FOR_PR' THEN
  -- Local PR representation only until the separately verified write-capability
  -- flow is configured. A browser cannot select this mode or report success.
  IF p.mode<>'REFERENCE_LAB' OR p_data->>'branch' IS DISTINCT FROM 'launchgate/fix/'||p.finding_id::text||'-'||p.id::text OR p_data->>'fixSha'=p.source_sha THEN RAISE EXCEPTION 'PR binding';END IF;
  SELECT actor_id INTO actor FROM launchgate_private.fix_requests WHERE proposal_id=p.id AND action='PR' ORDER BY created_at DESC LIMIT 1;
  PERFORM launchgate_private.source_actor(p.organization_id,actor,ARRAY['OWNER','ADMIN']);
  INSERT INTO public.lg_fix_pull_requests VALUES(p.id,p.organization_id,p.project_id,p.mode,p_data->>'branch',p_data->>'fixSha','local:'||p.id::text,actor,now());next_state:='PR_CREATED';
 ELSIF p_action='PREVIEW' AND p.next_action='VERIFY' AND p.state IN ('PR_CREATED','VERIFYING') THEN
  SELECT * INTO pr FROM public.lg_fix_pull_requests WHERE proposal_id=p.id;
  SELECT * INTO fv FROM public.lg_fix_verification_runs WHERE proposal_id=p.id;
  IF fv.proposal_id IS NOT NULL THEN SELECT * INTO rc FROM public.lg_release_candidates WHERE id=fv.release_id;
  ELSE
   IF p.mode<>'REFERENCE_LAB' THEN RAISE EXCEPTION 'authorized preview adapter unavailable';END IF;
   result:=public.lg_release_service('LAB_DEPLOYMENT',jsonb_build_object('projectId',p.project_id,'actorId',p.requested_by,'revision',pr.fix_sha));
   result:=public.lg_release_service('CREATE',jsonb_build_object('projectId',p.project_id,'actorId',p.requested_by,'policyId',p.policy_id,'policyVersion',p.policy_version,'deploymentId',result->>'deploymentId'));
   SELECT * INTO rc FROM public.lg_release_candidates WHERE id=(result->>'id')::uuid;
  END IF;
  IF rc.id IS NULL OR rc.commit_sha IS DISTINCT FROM pr.fix_sha OR rc.policy_id<>p.policy_id OR rc.policy_version<>p.policy_version OR rc.identity->>'environment' NOT IN ('SANDBOX','PREVIEW','STAGING') THEN RAISE EXCEPTION 'preview binding';END IF;
  INSERT INTO public.lg_fix_verification_runs(proposal_id,organization_id,project_id,release_id) VALUES(p.id,p.organization_id,p.project_id,rc.id) ON CONFLICT(proposal_id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM public.lg_fix_verification_runs WHERE proposal_id=p.id AND release_id=rc.id) THEN RAISE EXCEPTION 'preview conflict';END IF;
  UPDATE public.lg_fix_proposals SET state='VERIFYING' WHERE id=p.id;PERFORM launchgate_private.fix_event(p,'VERIFICATION_STARTED',p.requested_by);RETURN rc.identity;
 ELSIF p_action='ABANDON' AND p.next_action='VERIFY' THEN
  SELECT * INTO fv FROM public.lg_fix_verification_runs WHERE proposal_id=p.id;
  UPDATE public.lg_verification_runs SET state='CANCELLING',updated_at=now() WHERE id IN (SELECT run_id FROM public.lg_release_runs WHERE release_id=fv.release_id) AND state NOT IN ('COMPLETED','CANCELLED','FAILED_INFRASTRUCTURE');
  UPDATE public.lg_release_states SET state='CANCELLED',updated_at=now() WHERE release_id=fv.release_id;
  PERFORM launchgate_private.fix_event(p,'VERIFICATION_INTERRUPTED',p.requested_by);RETURN '{}'::jsonb;
 ELSIF p_action='RESULT' THEN
  SELECT * INTO fv FROM public.lg_fix_verification_runs WHERE proposal_id=p.id;
  SELECT * INTO ge FROM public.lg_gate_evaluations WHERE release_id=fv.release_id ORDER BY generation DESC LIMIT 1;
  RETURN jsonb_build_object('evaluation',ge.evaluation,'runs',coalesce((SELECT jsonb_agg(jsonb_build_object('invariantId',rr.invariant_id,'run',to_jsonb(vr),'authorization',to_jsonb(ta),'proof',to_jsonb(ap),'bundle',rb.bundle,'manifestDigest',rb.manifest_digest)) FROM public.lg_release_runs rr JOIN public.lg_verification_runs vr ON vr.id=rr.run_id JOIN public.lg_target_authorizations ta ON ta.id=vr.authorization_id JOIN public.lg_authorization_proofs ap ON ap.id=ta.proof_id LEFT JOIN public.lg_reproduction_bundles rb ON rb.run_id=vr.id WHERE rr.release_id=fv.release_id AND rr.generation=ge.generation),'[]'::jsonb));
 ELSIF p_action='COMPLETE' AND p.next_action='VERIFY' AND p.state='VERIFYING' THEN
  SELECT * INTO fv FROM public.lg_fix_verification_runs WHERE proposal_id=p.id FOR UPDATE;
  SELECT * INTO ge FROM public.lg_gate_evaluations WHERE release_id=fv.release_id ORDER BY generation DESC LIMIT 1;
  SELECT vr.* INTO r FROM public.lg_release_runs rr JOIN public.lg_verification_runs vr ON vr.id=rr.run_id JOIN public.lg_test_cases tc ON tc.run_id=vr.id WHERE rr.release_id=fv.release_id AND rr.generation=ge.generation AND tc.replay_of=p.finding_id;
  IF ge.id IS NULL OR r.id IS NULL OR r.state<>'COMPLETED' OR NOT EXISTS(SELECT 1 FROM public.lg_reproduction_bundles WHERE run_id=r.id) THEN RAISE EXCEPTION 'verification incomplete';END IF;
  next_state:=CASE WHEN ge.decision='SHIP' AND r.result='PASS' AND NOT EXISTS(SELECT 1 FROM public.lg_gate_evaluation_items WHERE evaluation_id=ge.id AND item->>'required'='true' AND status<>'PASS') AND jsonb_array_length(ge.evaluation->'exceptions')=0 AND (ge.evaluation->>'validUntil')::timestamptz>clock_timestamp() THEN 'VERIFIED' WHEN ge.decision='BLOCK' THEN 'VERIFICATION_FAILED' ELSE 'INCONCLUSIVE' END;
  IF next_state IS DISTINCT FROM p_data->>'status' OR p_data#>>'{evidence,proposalId}' IS DISTINCT FROM p.id::text OR p_data#>>'{evidence,releaseId}' IS DISTINCT FROM fv.release_id::text THEN RAISE EXCEPTION 'verification decision mismatch';END IF;
  UPDATE public.lg_fix_verification_runs SET state=next_state,evidence=p_data->'evidence',manifest_digest=p_data->>'manifest' WHERE proposal_id=p.id;
  IF next_state='VERIFIED' THEN
   UPDATE public.lg_findings SET state='RESOLVED',updated_at=now() WHERE id=p.finding_id AND active_replay=r.id;
   IF NOT FOUND THEN RAISE EXCEPTION 'replay superseded';END IF;
   INSERT INTO public.lg_finding_events(organization_id,project_id,finding_id,run_id,state) VALUES(p.organization_id,p.project_id,p.finding_id,r.id,'RESOLVED');
  ELSE
   UPDATE public.lg_findings SET state=CASE WHEN r.result='REPRODUCIBLE_FAILURE' THEN 'REGRESSION_FAILED' ELSE 'INCONCLUSIVE' END,updated_at=now() WHERE id=p.finding_id AND active_replay=r.id;
   IF FOUND THEN INSERT INTO public.lg_finding_events(organization_id,project_id,finding_id,run_id,state) VALUES(p.organization_id,p.project_id,p.finding_id,r.id,CASE WHEN r.result='REPRODUCIBLE_FAILURE' THEN 'REGRESSION_FAILED' ELSE 'INCONCLUSIVE' END);END IF;
  END IF;
 ELSIF p_action='FAIL' AND p_data->>'status' IN ('INCONCLUSIVE','REJECTED','STALE') THEN next_state:=p_data->>'status';
 ELSE RAISE EXCEPTION 'fix service transition' USING ERRCODE='42501';END IF;
 UPDATE public.lg_fix_proposals SET state=next_state,next_action=NULL,updated_at=now() WHERE id=p.id;
 PERFORM launchgate_private.fix_event(p,CASE p_action WHEN 'GENERATED' THEN 'PROPOSAL_GENERATED' WHEN 'VALIDATED' THEN 'PATCH_VALIDATED' WHEN 'PR_CREATED' THEN 'PR_CREATED' WHEN 'COMPLETE' THEN 'VERIFICATION_'||CASE WHEN next_state='VERIFIED' THEN 'PASSED' ELSE 'FAILED' END ELSE 'PROPOSAL_'||next_state END,p.requested_by);
 RETURN jsonb_build_object('state',next_state);
END $$;
REVOKE ALL ON FUNCTION launchgate_private.fix_event(public.lg_fix_proposals,text,uuid,uuid),public.lg_fix_service(text,jsonb),public.lg_fix_command(uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_fix_command(uuid,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lg_fix_service(text,jsonb) TO service_role;
COMMIT;
