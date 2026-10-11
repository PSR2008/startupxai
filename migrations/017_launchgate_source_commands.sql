BEGIN;
CREATE FUNCTION launchgate_private.source_actor(org uuid, actor_id uuid, roles text[]) RETURNS public.lg_organization_memberships
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.lg_organization_memberships;
BEGIN
 PERFORM 1 FROM public.lg_organizations WHERE id=org AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO actor FROM public.lg_organization_memberships WHERE organization_id=org AND user_id=actor_id AND status='ACTIVE' AND role=ANY(roles);
 IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
 RETURN actor;
END $$;
CREATE FUNCTION public.lg_github_setup(p_project uuid,p_state_hash text,p_installation bigint,p_repository bigint,p_root text,p_correlation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE project public.lg_projects; actor public.lg_organization_memberships;
BEGIN
 SELECT * INTO project FROM public.lg_projects WHERE id=p_project AND status='ACTIVE';
 actor:=launchgate_private.require_actor(project.organization_id,ARRAY['OWNER','ADMIN']);
 INSERT INTO launchgate_private.github_setup_states(state_hash,organization_id,project_id,actor_id,installation_id,repository_id,application_root)
 VALUES(p_state_hash,project.organization_id,p_project,auth.uid(),p_installation,p_repository,p_root);
 PERFORM launchgate_private.append_audit(project.organization_id,actor,'GITHUB_SETUP_STARTED','PROJECT',p_project,p_correlation);
END $$;
CREATE FUNCTION public.lg_disconnect_repository(p_project uuid,p_connection uuid,p_correlation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE conn public.lg_repository_connections; actor public.lg_organization_memberships;
BEGIN
 SELECT * INTO conn FROM public.lg_repository_connections WHERE id=p_connection AND project_id=p_project;
 actor:=launchgate_private.require_actor(conn.organization_id,ARRAY['OWNER','ADMIN']);
 UPDATE public.lg_repository_connections SET status='DISCONNECTED',updated_at=now() WHERE id=conn.id;
 UPDATE public.lg_repository_snapshots SET state='FAILED',failure_code='ACCESS_REVOKED',lease=NULL,lease_expires_at=NULL,updated_at=now() WHERE connection_id=conn.id AND state IN ('QUEUED','RUNNING');
 PERFORM launchgate_private.append_audit(conn.organization_id,actor,'GITHUB_DISCONNECTED','REPOSITORY_CONNECTION',conn.id,p_correlation);
END $$;
CREATE FUNCTION public.lg_request_snapshot(p_project uuid,p_connection uuid,p_sha text,p_correlation uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE conn public.lg_repository_connections; actor public.lg_organization_memberships; snapshot uuid;
BEGIN
 SELECT * INTO conn FROM public.lg_repository_connections WHERE id=p_connection AND project_id=p_project AND status='ACTIVE';
 actor:=launchgate_private.require_actor(conn.organization_id,ARRAY['OWNER','ADMIN','DEVELOPER']);
 PERFORM 1 FROM public.lg_projects WHERE id=p_project AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.lg_installation_repositories r JOIN public.lg_github_installations i ON i.id=r.installation_id WHERE r.id=conn.repository_id AND i.status='ACTIVE' FOR SHARE OF i;
 IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
 INSERT INTO public.lg_repository_snapshots(organization_id,project_id,connection_id,commit_sha,requested_by)
 VALUES(conn.organization_id,p_project,conn.id,p_sha,auth.uid()) ON CONFLICT(connection_id,commit_sha,analysis_version) DO NOTHING RETURNING id INTO snapshot;
 IF snapshot IS NULL THEN SELECT id INTO snapshot FROM public.lg_repository_snapshots WHERE connection_id=conn.id AND commit_sha=p_sha AND analysis_version='lg-static-1';
 ELSE PERFORM launchgate_private.append_audit(conn.organization_id,actor,'SNAPSHOT_REQUESTED','SNAPSHOT',snapshot,p_correlation); END IF;
 RETURN snapshot;
END $$;
CREATE FUNCTION public.lg_retry_snapshot(p_project uuid,p_snapshot uuid,p_correlation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.lg_repository_snapshots; actor public.lg_organization_memberships;
BEGIN
 SELECT * INTO s FROM public.lg_repository_snapshots WHERE id=p_snapshot AND project_id=p_project;
 actor:=launchgate_private.require_actor(s.organization_id,ARRAY['OWNER','ADMIN','DEVELOPER']);
 PERFORM 1 FROM public.lg_repository_connections c JOIN public.lg_installation_repositories r ON r.id=c.repository_id JOIN public.lg_github_installations i ON i.id=r.installation_id JOIN public.lg_projects p ON p.id=c.project_id WHERE c.id=s.connection_id AND c.status='ACTIVE' AND i.status='ACTIVE' AND p.status='ACTIVE' FOR SHARE OF c,i;
 IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
 IF s.state='FAILED' THEN
  UPDATE public.lg_repository_snapshots SET state='QUEUED',requested_by=auth.uid(),lease=NULL,lease_expires_at=NULL,failure_code=NULL,updated_at=now() WHERE id=s.id AND state='FAILED';
  IF FOUND THEN PERFORM launchgate_private.append_audit(s.organization_id,actor,'SNAPSHOT_REQUESTED','SNAPSHOT',s.id,p_correlation); END IF;
 END IF;
END $$;
CREATE FUNCTION public.lg_review_invariant(p_project uuid,p_proposal uuid,p_action text,p_statement text,p_request_key uuid,p_correlation uuid)
RETURNS public.lg_invariant_confirmations LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE proposal public.lg_invariant_proposals; actor public.lg_organization_memberships; review public.lg_invariant_confirmations; next_version integer;
BEGIN
 SELECT * INTO proposal FROM public.lg_invariant_proposals WHERE id=p_proposal AND project_id=p_project;
 actor:=launchgate_private.require_actor(proposal.organization_id,ARRAY['OWNER','ADMIN']);
 SELECT * INTO proposal FROM public.lg_invariant_proposals WHERE id=p_proposal FOR UPDATE;
 SELECT * INTO review FROM public.lg_invariant_confirmations WHERE proposal_id=p_proposal AND request_key=p_request_key;
 IF FOUND THEN
  IF review.action IS DISTINCT FROM p_action OR review.statement IS DISTINCT FROM p_statement OR review.actor_id<>auth.uid() THEN RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='22023'; END IF;
  RETURN review;
 END IF;
 SELECT coalesce(max(version),0)+1 INTO next_version FROM public.lg_invariant_confirmations WHERE proposal_id=p_proposal;
 INSERT INTO public.lg_invariant_confirmations(organization_id,project_id,proposal_id,version,action,statement,actor_id,request_key)
 VALUES(proposal.organization_id,p_project,p_proposal,next_version,p_action,p_statement,auth.uid(),p_request_key) RETURNING * INTO review;
 PERFORM launchgate_private.append_audit(proposal.organization_id,actor,'INVARIANT_REVIEWED','INVARIANT_PROPOSAL',proposal.id,p_correlation);
 RETURN review;
END $$;

-- Trusted provider/worker gateway. No service_role table grants; browser execution
-- is explicitly revoked. All trusted facts must be verified by the server adapter.
CREATE FUNCTION public.lg_source_service(p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE setup launchgate_private.github_setup_states; actor public.lg_organization_memberships;
 inst public.lg_github_installations; repo public.lg_installation_repositories; conn public.lg_repository_connections;
 snapshot public.lg_repository_snapshots; item jsonb; result uuid; inserted uuid;
BEGIN
 IF octet_length(p_data::text)>6291456 THEN RAISE EXCEPTION 'payload limit' USING ERRCODE='22023'; END IF;
 IF p_action IN ('READ_SETUP','BIND') THEN
  SELECT * INTO setup FROM launchgate_private.github_setup_states WHERE state_hash=p_data->>'stateHash' AND actor_id=(p_data->>'actorId')::uuid AND consumed_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
  actor:=launchgate_private.source_actor(setup.organization_id,setup.actor_id,ARRAY['OWNER','ADMIN']);
  PERFORM 1 FROM public.lg_projects WHERE id=setup.project_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
  IF p_action='READ_SETUP' THEN RETURN to_jsonb(setup); END IF;
  IF (p_data->>'installationId')::bigint<>setup.installation_id OR (p_data->>'repositoryId')::bigint<>setup.repository_id THEN RAISE EXCEPTION 'identity mismatch' USING ERRCODE='42501'; END IF;
  INSERT INTO public.lg_github_installations(organization_id,app_id,installation_id,account_id,status)
   VALUES(setup.organization_id,(p_data->>'appId')::bigint,setup.installation_id,(p_data->>'accountId')::bigint,'ACTIVE')
   ON CONFLICT(app_id,installation_id) DO UPDATE SET status='ACTIVE',updated_at=now()
    WHERE lg_github_installations.organization_id=setup.organization_id AND lg_github_installations.account_id=excluded.account_id RETURNING * INTO inst;
  IF inst.id IS NULL THEN RAISE EXCEPTION 'installation already bound' USING ERRCODE='42501'; END IF;
  INSERT INTO public.lg_installation_repositories(organization_id,installation_id,repository_id,owner_login,name,visibility,default_branch)
   VALUES(setup.organization_id,inst.id,setup.repository_id,p_data->>'owner',p_data->>'name',p_data->>'visibility',p_data->>'defaultBranch')
   ON CONFLICT(installation_id,repository_id) DO UPDATE SET owner_login=excluded.owner_login,name=excluded.name,visibility=excluded.visibility,default_branch=excluded.default_branch,updated_at=now() RETURNING * INTO repo;
  INSERT INTO public.lg_repository_connections(organization_id,project_id,repository_id,application_root,created_by)
   VALUES(setup.organization_id,setup.project_id,repo.id,setup.application_root,setup.actor_id)
   ON CONFLICT(project_id,repository_id,application_root) DO UPDATE SET status='ACTIVE',updated_at=now() RETURNING * INTO conn;
  UPDATE launchgate_private.github_setup_states SET consumed_at=now() WHERE state_hash=setup.state_hash;
  PERFORM launchgate_private.append_audit(setup.organization_id,actor,'GITHUB_CONNECTED','REPOSITORY_CONNECTION',conn.id,(p_data->>'correlationId')::uuid);
  RETURN jsonb_build_object('connectionId',conn.id);
 ELSIF p_action='WEBHOOK' THEN
  SELECT * INTO inst FROM public.lg_github_installations WHERE app_id=(p_data->>'appId')::bigint AND installation_id=(p_data->>'installationId')::bigint;
  IF inst.id IS NOT NULL THEN PERFORM 1 FROM public.lg_organizations WHERE id=inst.organization_id FOR UPDATE; END IF;
  INSERT INTO public.lg_integration_event_inbox(provider,mode,app_id,delivery_id,installation_id,organization_id,event_type,action,payload_digest,state)
   VALUES('GITHUB','APP',(p_data->>'appId')::bigint,(p_data->>'deliveryId')::uuid,(p_data->>'installationId')::bigint,inst.organization_id,p_data->>'event',p_data->>'action',p_data->>'digest',CASE WHEN p_data->>'action'='REVOKE' THEN 'PROCESSED' ELSE 'IGNORED' END)
   ON CONFLICT(provider,mode,app_id,delivery_id) DO NOTHING RETURNING id INTO inserted;
  IF inserted IS NULL THEN RETURN jsonb_build_object('duplicate',true); END IF;
  IF p_data->>'action'='REVOKE' AND inst.id IS NOT NULL THEN
   UPDATE public.lg_github_installations SET status='REVOKED',updated_at=now() WHERE id=inst.id;
   UPDATE public.lg_repository_snapshots SET state='FAILED',failure_code='ACCESS_REVOKED',lease=NULL,lease_expires_at=NULL,updated_at=now() WHERE state IN ('QUEUED','RUNNING') AND connection_id IN (SELECT c.id FROM public.lg_repository_connections c JOIN public.lg_installation_repositories r ON r.id=c.repository_id WHERE r.installation_id=inst.id);
  END IF;
  RETURN jsonb_build_object('duplicate',false);
 ELSIF p_action IN ('CLAIM','CHECK','COMPLETE','FAIL') THEN
  SELECT * INTO snapshot FROM public.lg_repository_snapshots WHERE id=(p_data->>'snapshotId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.lg_organizations WHERE id=snapshot.organization_id AND status='ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO snapshot FROM public.lg_repository_snapshots WHERE id=snapshot.id FOR UPDATE;
  actor:=launchgate_private.source_actor(snapshot.organization_id,snapshot.requested_by,ARRAY['OWNER','ADMIN','DEVELOPER']);
  SELECT c.* INTO conn FROM public.lg_repository_connections c JOIN public.lg_projects p ON p.id=c.project_id WHERE c.id=snapshot.connection_id AND c.status='ACTIVE' AND p.status='ACTIVE' FOR SHARE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO repo FROM public.lg_installation_repositories WHERE id=conn.repository_id;
  SELECT * INTO inst FROM public.lg_github_installations WHERE id=repo.installation_id AND status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
  IF p_action='CLAIM' THEN
   IF snapshot.state NOT IN ('QUEUED','RUNNING') OR (snapshot.state='RUNNING' AND snapshot.lease_expires_at>now()) THEN RETURN NULL; END IF;
   UPDATE public.lg_repository_snapshots SET state='RUNNING',lease=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',updated_at=now() WHERE id=snapshot.id RETURNING * INTO snapshot;
   RETURN jsonb_build_object('snapshot',to_jsonb(snapshot),'connection',to_jsonb(conn),'repository',to_jsonb(repo),'installation',to_jsonb(inst));
  END IF;
  IF snapshot.state<>'RUNNING' OR snapshot.lease IS DISTINCT FROM (p_data->>'lease')::uuid OR snapshot.lease_expires_at<=now() THEN RAISE EXCEPTION 'stale lease' USING ERRCODE='42501'; END IF;
  IF p_action='CHECK' THEN RETURN '{}'::jsonb; END IF;
  IF p_action='FAIL' THEN
   UPDATE public.lg_repository_snapshots SET state='FAILED',failure_code=p_data->>'code',lease=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=snapshot.id; RETURN '{}'::jsonb;
  END IF;
  IF p_data->>'commitSha' IS DISTINCT FROM snapshot.commit_sha OR p_data->'report'->>'analysisVersion' IS DISTINCT FROM snapshot.analysis_version OR jsonb_array_length(p_data->'files')>200 OR jsonb_array_length(p_data->'report'->'proposals')>7 THEN RAISE EXCEPTION 'invalid analysis' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_data->'files') LOOP
   INSERT INTO public.lg_source_files(organization_id,project_id,snapshot_id,path,digest,blob_sha,bytes,classification)
    VALUES(snapshot.organization_id,snapshot.project_id,snapshot.id,item->>'path',item->>'digest',item->>'blobSha',(item->>'bytes')::integer,item->>'classification');
  END LOOP;
  INSERT INTO public.lg_architecture_snapshots(snapshot_id,organization_id,project_id,report,report_digest)
   VALUES(snapshot.id,snapshot.organization_id,snapshot.project_id,p_data->'report',p_data->>'reportDigest');
  FOR item IN SELECT value FROM jsonb_array_elements(p_data->'report'->'proposals') LOOP
   INSERT INTO public.lg_invariant_proposals(organization_id,project_id,snapshot_id,proposal_key,domain,statement,details)
    VALUES(snapshot.organization_id,snapshot.project_id,snapshot.id,item->>'id',item->>'domain',item->>'statement',item) RETURNING id INTO result;
  END LOOP;
  UPDATE public.lg_repository_snapshots SET state='COMPLETE',source_state=p_data->>'sourceState',tree_sha=p_data->>'treeSha',lease=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=snapshot.id;
  RETURN jsonb_build_object('snapshotId',snapshot.id);
 ELSE RAISE EXCEPTION 'unsupported service command' USING ERRCODE='22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION launchgate_private.source_actor(uuid,uuid,text[]) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.lg_source_service(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_source_service(text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.lg_github_setup(uuid,text,bigint,bigint,text,uuid),public.lg_disconnect_repository(uuid,uuid,uuid),public.lg_request_snapshot(uuid,uuid,text,uuid),public.lg_retry_snapshot(uuid,uuid,uuid),public.lg_review_invariant(uuid,uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_github_setup(uuid,text,bigint,bigint,text,uuid),public.lg_disconnect_repository(uuid,uuid,uuid),public.lg_request_snapshot(uuid,uuid,text,uuid),public.lg_retry_snapshot(uuid,uuid,uuid),public.lg_review_invariant(uuid,uuid,text,text,uuid,uuid) TO authenticated;
COMMIT;
