BEGIN;
CREATE FUNCTION public.lg_read_security_membership(p_organization uuid)
RETURNS SETOF public.lg_organization_memberships LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.* FROM public.lg_organization_memberships m JOIN public.lg_organizations o ON o.id=m.organization_id
  WHERE m.organization_id=p_organization AND m.user_id=auth.uid() AND m.status='ACTIVE'
    AND m.role IN ('OWNER','ADMIN') AND o.status IN ('ACTIVE','DELETION_PENDING');
$$;
REVOKE ALL ON FUNCTION public.lg_read_security_membership(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_read_security_membership(uuid) TO authenticated;
-- Each SECURITY DEFINER command verifies auth.uid(), locks the organization,
-- repeats current membership authorization, and audits in the same transaction.
CREATE FUNCTION launchgate_private.require_actor(org uuid, roles text[])
RETURNS public.lg_organization_memberships LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.lg_organization_memberships;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.lg_organizations WHERE id=org AND status='ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO actor FROM public.lg_organization_memberships
    WHERE organization_id=org AND user_id=auth.uid() AND status='ACTIVE' AND role=ANY(roles);
  IF NOT FOUND THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
  RETURN actor;
END $$;

CREATE FUNCTION public.lg_create_organization(p_name text, p_correlation uuid)
RETURNS public.lg_organizations LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE org public.lg_organizations; actor public.lg_organization_memberships;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.lg_organizations(name,created_by) VALUES(btrim(p_name),auth.uid()) RETURNING * INTO org;
  INSERT INTO public.lg_organization_memberships(organization_id,user_id,role)
    VALUES(org.id,auth.uid(),'OWNER') RETURNING * INTO actor;
  PERFORM launchgate_private.append_audit(org.id,actor,'ORGANIZATION_CREATED','ORGANIZATION',org.id,p_correlation);
  RETURN org;
END $$;

-- ADD references an already registered user UUID. Invitations/email delivery are deferred.
-- ADMIN manages only DEVELOPER/VIEWER; only OWNER may grant OWNER or transfer ownership.
CREATE FUNCTION public.lg_manage_member(p_organization uuid, p_action text, p_user uuid,
  p_membership uuid, p_role text, p_status text, p_correlation uuid)
RETURNS public.lg_organization_memberships LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.lg_organization_memberships; target public.lg_organization_memberships; op text;
BEGIN
  actor := launchgate_private.require_actor(p_organization,ARRAY['OWNER','ADMIN']);
  IF p_action IS NULL OR p_action NOT IN ('ADD','UPDATE','REMOVE','TRANSFER') THEN
    RAISE EXCEPTION 'invalid action' USING ERRCODE='22023';
  END IF;
  IF p_action='ADD' THEN
    IF p_role IS NULL OR p_role NOT IN ('OWNER','ADMIN','DEVELOPER','VIEWER') OR p_status IS DISTINCT FROM 'ACTIVE' THEN
      RAISE EXCEPTION 'invalid role/status' USING ERRCODE='22023'; END IF;
    IF actor.role='ADMIN' AND p_role NOT IN ('DEVELOPER','VIEWER') THEN
      RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
    INSERT INTO public.lg_organization_memberships(organization_id,user_id,role)
      VALUES(p_organization,p_user,p_role) RETURNING * INTO target;
    op := 'MEMBER_ADDED';
  ELSE
    SELECT * INTO target FROM public.lg_organization_memberships WHERE organization_id=p_organization AND id=p_membership;
    IF NOT FOUND OR (actor.role='ADMIN' AND target.role NOT IN ('DEVELOPER','VIEWER')) THEN
      RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
    IF p_action='TRANSFER' THEN
      IF actor.role<>'OWNER' OR target.status<>'ACTIVE' OR target.id=actor.id THEN
        RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
      UPDATE public.lg_organization_memberships SET role='OWNER',updated_at=now() WHERE id=target.id RETURNING * INTO target;
      UPDATE public.lg_organization_memberships SET role='ADMIN',updated_at=now() WHERE id=actor.id;
      op := 'OWNERSHIP_TRANSFERRED';
    ELSIF p_action='REMOVE' THEN
      UPDATE public.lg_organization_memberships SET status='REMOVED',updated_at=now() WHERE id=target.id RETURNING * INTO target;
      op := 'MEMBER_REMOVED';
    ELSE
      IF p_role IS NULL OR p_role NOT IN ('OWNER','ADMIN','DEVELOPER','VIEWER') OR p_status IS NULL OR p_status NOT IN ('ACTIVE','DISABLED','REMOVED') THEN
        RAISE EXCEPTION 'invalid role/status' USING ERRCODE='22023'; END IF;
      IF actor.role='ADMIN' AND p_role NOT IN ('DEVELOPER','VIEWER') THEN
        RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
      UPDATE public.lg_organization_memberships SET role=p_role,status=p_status,updated_at=now() WHERE id=target.id RETURNING * INTO target;
      op := 'MEMBER_UPDATED';
    END IF;
  END IF;
  PERFORM launchgate_private.append_audit(p_organization,actor,op,'MEMBERSHIP',target.id,p_correlation);
  RETURN target;
END $$;

CREATE FUNCTION public.lg_create_project(p_organization uuid,p_name text,p_correlation uuid)
RETURNS public.lg_projects LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.lg_organization_memberships; project public.lg_projects;
BEGIN
  actor := launchgate_private.require_actor(p_organization,ARRAY['OWNER','ADMIN','DEVELOPER']);
  INSERT INTO public.lg_projects(organization_id,name,created_by) VALUES(p_organization,btrim(p_name),auth.uid()) RETURNING * INTO project;
  PERFORM launchgate_private.append_audit(p_organization,actor,'PROJECT_CREATED','PROJECT',project.id,p_correlation);
  RETURN project;
END $$;

CREATE FUNCTION public.lg_set_retention(p_organization uuid,p_project uuid,p_category text,p_days integer,p_correlation uuid)
RETURNS public.lg_retention_policies LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.lg_organization_memberships; policy public.lg_retention_policies;
BEGIN
  actor := launchgate_private.require_actor(p_organization,ARRAY['OWNER','ADMIN']);
  SELECT * INTO policy FROM public.lg_retention_policies WHERE organization_id=p_organization
    AND project_id IS NOT DISTINCT FROM p_project AND category=p_category;
  IF FOUND THEN
    UPDATE public.lg_retention_policies SET duration_days=p_days,updated_by=auth.uid(),updated_at=now() WHERE id=policy.id RETURNING * INTO policy;
  ELSE
    INSERT INTO public.lg_retention_policies(organization_id,project_id,category,duration_days,updated_by)
      VALUES(p_organization,p_project,p_category,p_days,auth.uid()) RETURNING * INTO policy;
  END IF;
  PERFORM launchgate_private.append_audit(p_organization,actor,'RETENTION_UPDATED','RETENTION_POLICY',policy.id,p_correlation);
  RETURN policy;
END $$;

CREATE FUNCTION public.lg_request_deletion(p_organization uuid,p_correlation uuid)
RETURNS public.lg_deletion_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.lg_organization_memberships; request public.lg_deletion_requests;
BEGIN
  actor := launchgate_private.require_actor(p_organization,ARRAY['OWNER']);
  INSERT INTO public.lg_deletion_requests(organization_id,requested_by,state,authorized_at)
    VALUES(p_organization,auth.uid(),'AUTHORIZED',now()) RETURNING * INTO request;
  UPDATE public.lg_organizations SET status='DELETION_PENDING',updated_at=now() WHERE id=p_organization;
  INSERT INTO public.lg_deletion_tasks(organization_id,deletion_request_id,category)
    SELECT p_organization,request.id,category FROM unnest(ARRAY['SOURCE_SNAPSHOTS','ARTIFACTS','FINDINGS','CREDENTIALS','DATABASE_ROWS','BACKUP_EXPIRY','LEGAL_RETENTION_REVIEW']) category;
  PERFORM launchgate_private.append_audit(p_organization,actor,'DELETION_REQUESTED','DELETION_REQUEST',request.id,p_correlation);
  RETURN request;
END $$;

-- No worker credential or public transition RPC exists yet. The database still
-- rejects invalid transitions and premature completion by a future privileged worker.
CREATE FUNCTION launchgate_private.deletion_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id THEN
    RAISE EXCEPTION 'immutable deletion identity' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='lg_deletion_tasks' THEN
    IF NEW.deletion_request_id<>OLD.deletion_request_id OR NEW.category<>OLD.category THEN
      RAISE EXCEPTION 'immutable task identity' USING ERRCODE='23514'; END IF;
    PERFORM 1 FROM public.lg_deletion_requests WHERE id=OLD.deletion_request_id AND state='RUNNING' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'request not running' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.state<>OLD.state AND NOT (
    (OLD.state='REQUESTED' AND NEW.state=CASE WHEN TG_TABLE_NAME='lg_deletion_requests' THEN 'AUTHORIZED' ELSE 'RUNNING' END) OR
    (OLD.state='AUTHORIZED' AND NEW.state='RUNNING') OR
    (OLD.state='RUNNING' AND NEW.state IN ('COMPLETED','FAILED')) OR
    (OLD.state='FAILED' AND NEW.state='RUNNING')) THEN
    RAISE EXCEPTION 'invalid deletion transition' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='lg_deletion_requests' AND NEW.state='COMPLETED' THEN
    IF (SELECT count(*) FROM public.lg_deletion_tasks WHERE deletion_request_id=OLD.id)<>7 OR
      EXISTS (SELECT 1 FROM public.lg_deletion_tasks WHERE deletion_request_id=OLD.id AND state<>'COMPLETED') THEN
      RAISE EXCEPTION 'cleanup incomplete' USING ERRCODE='23514'; END IF;
    UPDATE public.lg_organizations SET status='DELETED',updated_at=now() WHERE id=OLD.organization_id;
    NEW.completed_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER lg_request_transition BEFORE UPDATE ON public.lg_deletion_requests FOR EACH ROW EXECUTE FUNCTION launchgate_private.deletion_transition();
CREATE TRIGGER lg_task_transition BEFORE UPDATE ON public.lg_deletion_tasks FOR EACH ROW EXECUTE FUNCTION launchgate_private.deletion_transition();
REVOKE ALL ON FUNCTION launchgate_private.require_actor(uuid,text[]), launchgate_private.deletion_transition() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.lg_create_organization(text,uuid), public.lg_manage_member(uuid,text,uuid,uuid,text,text,uuid), public.lg_create_project(uuid,text,uuid), public.lg_set_retention(uuid,uuid,text,integer,uuid), public.lg_request_deletion(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_create_organization(text,uuid), public.lg_manage_member(uuid,text,uuid,uuid,text,text,uuid), public.lg_create_project(uuid,text,uuid), public.lg_set_retention(uuid,uuid,text,integer,uuid), public.lg_request_deletion(uuid,uuid) TO authenticated;
COMMIT;
