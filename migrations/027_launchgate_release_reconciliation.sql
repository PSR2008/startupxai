BEGIN;
ALTER TABLE public.lg_release_states ADD COLUMN check_started_generation integer NOT NULL DEFAULT 0;
ALTER FUNCTION public.lg_release_service(text,jsonb) RENAME TO lg_release_service_v8_execution;
CREATE FUNCTION public.lg_release_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;rc public.lg_release_candidates;st public.lg_release_states;cfg public.lg_release_configurations;ev record;sid uuid;mapping jsonb;origin jsonb;finding public.lg_findings;
BEGIN
 IF p_action='DISCOVER' THEN
  FOR ev IN SELECT rs.release_id,c.project_id,c.requested_by FROM public.lg_release_states rs JOIN public.lg_release_candidates c ON c.id=rs.release_id JOIN public.lg_gate_evaluations ge ON ge.release_id=rs.release_id AND ge.generation=rs.generation
   WHERE rs.state='DECIDED' AND ge.decision='SHIP' AND (ge.evaluation->>'validUntil')::timestamptz<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM launchgate_private.release_leases le WHERE le.release_id=rs.release_id AND le.expires_at>clock_timestamp()) FOR UPDATE OF rs SKIP LOCKED LOOP
   UPDATE public.lg_release_states SET generation=generation+1,state='READY',updated_at=now() WHERE release_id=ev.release_id;
   UPDATE public.lg_github_check_runs SET publication_state='SUPERSEDED' WHERE publication_state='PENDING' AND evaluation_id IN (SELECT id FROM public.lg_gate_evaluations WHERE release_id=ev.release_id);
   PERFORM launchgate_private.release_event(ev.project_id,ev.release_id,ev.requested_by,'ASSURANCE_EXPIRED');
  END LOOP;
  -- Queue exact source snapshots without a browser request. The existing
  -- authenticated source worker owns ingestion and architecture provenance.
  FOR ev IN SELECT d.*,c.connection_id,c.organization_id,c.project_id,c.requested_by FROM launchgate_private.release_deliveries d
   JOIN public.lg_github_installations gi ON gi.app_id=d.app_id AND gi.installation_id=d.installation_id AND gi.status='ACTIVE'
   JOIN public.lg_installation_repositories ir ON ir.installation_id=gi.id AND ir.repository_id=d.repository_id
   JOIN public.lg_repository_connections conn ON conn.repository_id=ir.id AND conn.status='ACTIVE'
   JOIN public.lg_release_configurations c ON c.connection_id=conn.id AND c.enabled WHERE d.state='WAITING_FOR_DEPLOYMENT' LIMIT 100 LOOP
   PERFORM launchgate_private.source_actor(ev.organization_id,ev.requested_by,ARRAY['OWNER','ADMIN']);
   INSERT INTO public.lg_repository_snapshots(organization_id,project_id,connection_id,commit_sha,requested_by) VALUES(ev.organization_id,ev.project_id,ev.connection_id,ev.head_sha,ev.requested_by) ON CONFLICT DO NOTHING;
   IF ev.base_sha ~ '^[a-f0-9]{40}$' THEN INSERT INTO public.lg_repository_snapshots(organization_id,project_id,connection_id,commit_sha,requested_by) VALUES(ev.organization_id,ev.project_id,ev.connection_id,ev.base_sha,ev.requested_by) ON CONFLICT DO NOTHING;END IF;
  END LOOP;
  RETURN public.lg_release_service_v8_execution(p_action,p_data);
 ELSIF p_action='PENDING_SNAPSHOTS' THEN
  RETURN coalesce((SELECT jsonb_agg(s.id) FROM (SELECT rs.id FROM public.lg_repository_snapshots rs JOIN public.lg_release_configurations c ON c.connection_id=rs.connection_id AND c.enabled WHERE rs.state='QUEUED' ORDER BY rs.created_at LIMIT 10) s),'[]'::jsonb);
 ELSIF p_action='CLAIM' THEN
  -- Serialize claim selection so two candidates for the same SHA cannot
  -- concurrently update their shared operational GitHub Check.
  PERFORM pg_advisory_xact_lock(728104);
  result:=public.lg_release_service_v8_execution(p_action,p_data);
  IF result IS NULL THEN RETURN NULL;END IF;
  SELECT * INTO rc FROM public.lg_release_candidates WHERE id=(result->>'releaseId')::uuid;
  IF rc.connection_id IS NOT NULL AND EXISTS(SELECT 1 FROM launchgate_private.release_leases l JOIN public.lg_release_candidates c ON c.id=l.release_id WHERE c.id<>rc.id AND c.connection_id=rc.connection_id AND c.commit_sha=rc.commit_sha AND l.expires_at>clock_timestamp()) THEN
   UPDATE launchgate_private.release_leases SET expires_at=clock_timestamp() WHERE release_id=rc.id;RETURN NULL;
  END IF;RETURN result;
 END IF;
 IF p_action IN ('CHECK_STARTED','DEPENDENCY','FINDING_SOURCE') THEN
  PERFORM public.lg_release_service_v8_execution('CHECK',p_data);
  SELECT * INTO rc FROM public.lg_release_candidates WHERE id=(p_data->>'releaseId')::uuid;
  SELECT * INTO st FROM public.lg_release_states WHERE release_id=rc.id;
  IF p_action='CHECK_STARTED' THEN
   UPDATE public.lg_release_states SET check_started_generation=st.generation WHERE release_id=rc.id;
   PERFORM launchgate_private.release_event(rc.project_id,rc.id,rc.requested_by,'GITHUB_ASSURANCE_PENDING');RETURN '{}'::jsonb;
  ELSIF p_action='DEPENDENCY' THEN
   mapping:=p_data->'mapping';sid:=(mapping->>'snapshotId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM public.lg_policy_invariants WHERE policy_id=rc.policy_id AND policy_version=rc.policy_version AND invariant_id=(mapping->>'invariantId')::uuid AND invariant_version=(mapping->>'invariantVersion')::int) THEN RAISE EXCEPTION 'dependency scope';END IF;
   INSERT INTO public.lg_invariant_dependencies(organization_id,project_id,policy_id,policy_version,invariant_id,snapshot_id,mapping) VALUES(rc.organization_id,rc.project_id,rc.policy_id,rc.policy_version,(mapping->>'invariantId')::uuid,sid,mapping);
   IF p_data->>'findingId' IS NOT NULL THEN INSERT INTO public.lg_regression_dependencies(organization_id,project_id,finding_id,snapshot_id,mapping) VALUES(rc.organization_id,rc.project_id,(p_data->>'findingId')::uuid,sid,mapping);END IF;
   PERFORM launchgate_private.release_event(rc.project_id,rc.id,rc.requested_by,'DEPENDENCY_RECORDED');RETURN '{}'::jsonb;
  ELSE
   SELECT * INTO finding FROM public.lg_findings WHERE id=(p_data->>'findingId')::uuid AND organization_id=rc.organization_id AND project_id=rc.project_id;
   SELECT vr.snapshot_id INTO sid FROM public.lg_finding_occurrences fo JOIN public.lg_verification_runs vr ON vr.id=fo.run_id WHERE fo.finding_id=finding.id AND fo.outcome='REPRODUCIBLE_FAILURE' ORDER BY vr.created_at DESC LIMIT 1;
   SELECT jsonb_build_object('id',s.id,'connectionId',s.connection_id,'commitSha',s.commit_sha,'files',coalesce((SELECT jsonb_agg(jsonb_build_object('path',f.path,'digest',f.digest,'blobSha',f.blob_sha)) FROM public.lg_source_files f WHERE f.snapshot_id=s.id),'[]'::jsonb),'report',a.report) INTO origin FROM public.lg_repository_snapshots s JOIN public.lg_architecture_snapshots a ON a.snapshot_id=s.id WHERE s.id=sid;
   RETURN origin;
  END IF;
 END IF;
 result:=public.lg_release_service_v8_execution(p_action,p_data);
 IF p_action='LOAD' AND result IS NOT NULL THEN
  SELECT * INTO rc FROM public.lg_release_candidates WHERE id=(p_data->>'releaseId')::uuid;
  SELECT * INTO st FROM public.lg_release_states WHERE release_id=rc.id;
  FOR ev IN SELECT e.id FROM public.lg_policy_exceptions e WHERE e.release_id=rc.id AND e.revoked_at IS NULL AND e.expires_at<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM public.lg_release_events re WHERE re.reference_id=e.id AND re.kind='EXCEPTION_EXPIRED') LOOP
   PERFORM launchgate_private.release_event(rc.project_id,rc.id,rc.requested_by,'EXCEPTION_EXPIRED',ev.id);
  END LOOP;
  result:=result||jsonb_build_object('selection',st.selection,'checkStartedGeneration',st.check_started_generation);
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.lg_release_service_v8_execution(text,jsonb),public.lg_release_service(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_release_service(text,jsonb) TO service_role;
COMMIT;
