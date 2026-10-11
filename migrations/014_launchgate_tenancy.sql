-- Forward only. Existing StartupX objects and policies are intentionally untouched.
BEGIN;
CREATE SCHEMA launchgate_private;
REVOKE ALL ON SCHEMA launchgate_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA launchgate_private TO authenticated;

CREATE TABLE public.lg_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DELETION_PENDING','DELETED')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lg_organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.lg_organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('OWNER','ADMIN','DEVELOPER','VIEWER')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED','REMOVED')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,user_id), UNIQUE (organization_id,id)
);
CREATE INDEX lg_membership_user ON public.lg_organization_memberships(user_id, organization_id);
CREATE TABLE public.lg_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.lg_organizations(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);
CREATE TABLE public.lg_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.lg_organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL, actor_membership_id uuid NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('OWNER','ADMIN','DEVELOPER','VIEWER')),
  operation text NOT NULL CHECK (operation IN ('ORGANIZATION_CREATED','MEMBER_ADDED','MEMBER_UPDATED','MEMBER_REMOVED','OWNERSHIP_TRANSFERRED','PROJECT_CREATED','RETENTION_UPDATED','DELETION_REQUESTED')),
  target_type text NOT NULL CHECK (target_type IN ('ORGANIZATION','MEMBERSHIP','PROJECT','RETENTION_POLICY','DELETION_REQUEST')),
  target_id uuid NOT NULL, correlation_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome = 'SUCCEEDED'),
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (safe_metadata = '{}'::jsonb),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,actor_membership_id) REFERENCES public.lg_organization_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX lg_audit_org_time ON public.lg_audit_events(organization_id,created_at DESC,id);
CREATE TABLE public.lg_secret_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.lg_organizations(id) ON DELETE RESTRICT,
  project_id uuid,
  kind text NOT NULL CHECK (kind IN ('PROVIDER_CREDENTIAL','TARGET_CREDENTIAL','SIGNING_KEY')),
  provider text NOT NULL CHECK (provider IN ('MANAGED_SECRET_BACKEND')),
  backend_reference uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('INTEGRATION','TEST_IDENTITY','SIGNING')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), last_rotated_at timestamptz, revoked_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL)),
  CHECK (last_rotated_at IS NULL OR last_rotated_at >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  FOREIGN KEY (organization_id,project_id) REFERENCES public.lg_projects(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.lg_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.lg_organizations(id) ON DELETE RESTRICT,
  project_id uuid,
  category text NOT NULL CHECK (category IN ('SOURCE_SNAPSHOTS','ARTIFACTS','FINDINGS','AUDIT_EVENTS','CREDENTIALS')),
  duration_days integer NOT NULL CHECK (duration_days BETWEEN 1 AND 3650),
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,project_id) REFERENCES public.lg_projects(organization_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX lg_retention_org_unique ON public.lg_retention_policies(organization_id,category) WHERE project_id IS NULL;
CREATE UNIQUE INDEX lg_retention_project_unique ON public.lg_retention_policies(organization_id,project_id,category) WHERE project_id IS NOT NULL;
CREATE TABLE public.lg_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.lg_organizations(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('REQUESTED','AUTHORIZED','RUNNING','COMPLETED','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz, completed_at timestamptz,
  UNIQUE (organization_id,id), UNIQUE (organization_id),
  CHECK ((state = 'COMPLETED') = (completed_at IS NOT NULL)),
  CHECK (state = 'REQUESTED' OR authorized_at IS NOT NULL)
);
CREATE TABLE public.lg_deletion_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.lg_organizations(id) ON DELETE RESTRICT,
  deletion_request_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('SOURCE_SNAPSHOTS','ARTIFACTS','FINDINGS','CREDENTIALS','DATABASE_ROWS','BACKUP_EXPIRY','LEGAL_RETENTION_REVIEW')),
  state text NOT NULL DEFAULT 'REQUESTED' CHECK (state IN ('REQUESTED','RUNNING','COMPLETED','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deletion_request_id,category),
  FOREIGN KEY (organization_id,deletion_request_id) REFERENCES public.lg_deletion_requests(organization_id,id) ON DELETE RESTRICT
);

-- Stable, non-recursive RLS lookup. Only this boolean helper is executable by users.
CREATE FUNCTION launchgate_private.has_role(org uuid, roles text[], allow_pending boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.lg_organization_memberships m
    JOIN public.lg_organizations o ON o.id=m.organization_id
    WHERE m.organization_id=org AND m.user_id=auth.uid() AND m.status='ACTIVE'
      AND m.role=ANY(roles) AND (o.status='ACTIVE' OR (allow_pending AND o.status='DELETION_PENDING')));
$$;
REVOKE ALL ON FUNCTION launchgate_private.has_role(uuid,text[],boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION launchgate_private.has_role(uuid,text[],boolean) TO authenticated;

-- All mutations serialize against the organization row. This also prevents two owners
-- concurrently demoting each other. Do not replace with an unlocked count in a route.
CREATE FUNCTION launchgate_private.protect_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.organization_id<>OLD.organization_id OR NEW.user_id<>OLD.user_id OR NEW.id<>OLD.id) THEN
    RAISE EXCEPTION 'immutable membership identity' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM public.lg_organizations WHERE id=OLD.organization_id FOR UPDATE;
  IF OLD.role='OWNER' AND OLD.status='ACTIVE' AND
     (TG_OP='DELETE' OR NEW.role<>'OWNER' OR NEW.status<>'ACTIVE') AND
     NOT EXISTS (SELECT 1 FROM public.lg_organization_memberships WHERE organization_id=OLD.organization_id AND id<>OLD.id AND role='OWNER' AND status='ACTIVE') THEN
    RAISE EXCEPTION 'last owner protected' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lg_protect_owner BEFORE UPDATE OR DELETE ON public.lg_organization_memberships
FOR EACH ROW EXECUTE FUNCTION launchgate_private.protect_owner();

CREATE FUNCTION launchgate_private.append_audit(org uuid, actor public.lg_organization_memberships,
  op text, target_kind text, target uuid, correlation uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.lg_audit_events(organization_id,actor_user_id,actor_membership_id,actor_role,operation,target_type,target_id,correlation_id,outcome)
  VALUES(org,actor.user_id,actor.id,actor.role,op,target_kind,target,correlation,'SUCCEEDED');
$$;
CREATE FUNCTION launchgate_private.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'audit is append only' USING ERRCODE='42501'; END $$;
CREATE TRIGGER lg_audit_append_only BEFORE UPDATE OR DELETE ON public.lg_audit_events
FOR EACH ROW EXECUTE FUNCTION launchgate_private.reject_audit_mutation();

-- No broad DML grants, including to service_role. All browser writes go through
-- the bounded authenticated RPCs in 015. RLS independently denies direct DML.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['lg_organizations','lg_organization_memberships','lg_projects','lg_audit_events','lg_secret_references','lg_retention_policies','lg_deletion_requests','lg_deletion_tasks'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',t);
    IF t <> 'lg_secret_references' THEN EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',t); END IF;
  END LOOP;
END $$;
GRANT SELECT(id,organization_id,project_id,kind,provider,purpose,created_by,created_at,last_rotated_at,revoked_at,status)
  ON public.lg_secret_references TO authenticated;
CREATE POLICY lg_org_read ON public.lg_organizations FOR SELECT TO authenticated
  USING (launchgate_private.has_role(id,ARRAY['OWNER','ADMIN','DEVELOPER','VIEWER']));
CREATE POLICY lg_member_read ON public.lg_organization_memberships FOR SELECT TO authenticated
  USING (launchgate_private.has_role(organization_id,ARRAY['OWNER','ADMIN','DEVELOPER','VIEWER']));
CREATE POLICY lg_project_read ON public.lg_projects FOR SELECT TO authenticated
  USING (launchgate_private.has_role(organization_id,ARRAY['OWNER','ADMIN','DEVELOPER','VIEWER']));
CREATE POLICY lg_audit_read ON public.lg_audit_events FOR SELECT TO authenticated
  USING (launchgate_private.has_role(organization_id,ARRAY['OWNER','ADMIN'],true));
CREATE POLICY lg_secret_read ON public.lg_secret_references FOR SELECT TO authenticated
  USING (launchgate_private.has_role(organization_id,ARRAY['OWNER','ADMIN']));
CREATE POLICY lg_retention_read ON public.lg_retention_policies FOR SELECT TO authenticated
  USING (launchgate_private.has_role(organization_id,ARRAY['OWNER','ADMIN','DEVELOPER','VIEWER']));
CREATE POLICY lg_deletion_read ON public.lg_deletion_requests FOR SELECT TO authenticated
  USING (launchgate_private.has_role(organization_id,ARRAY['OWNER','ADMIN'],true));
CREATE POLICY lg_task_read ON public.lg_deletion_tasks FOR SELECT TO authenticated
  USING (launchgate_private.has_role(organization_id,ARRAY['OWNER','ADMIN'],true));
REVOKE ALL ON FUNCTION launchgate_private.protect_owner(), launchgate_private.append_audit(uuid,public.lg_organization_memberships,text,text,uuid,uuid), launchgate_private.reject_audit_mutation() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
