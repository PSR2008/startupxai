BEGIN;
-- Bounded source-analysis metadata. No raw source, credentials or provider tokens.
CREATE TABLE public.lg_github_installations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.lg_organizations(id),
 app_id bigint NOT NULL CHECK(app_id>0), installation_id bigint NOT NULL CHECK(installation_id>0), account_id bigint NOT NULL CHECK(account_id>0),
 status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED','DISCONNECTED')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(app_id,installation_id), UNIQUE(organization_id,id)
);
CREATE TABLE public.lg_installation_repositories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, installation_id uuid NOT NULL,
 repository_id bigint NOT NULL CHECK(repository_id>0), owner_login text NOT NULL CHECK(owner_login ~ '^[A-Za-z0-9_.-]{1,100}$'),
 name text NOT NULL CHECK(name ~ '^[A-Za-z0-9_.-]{1,100}$'), visibility text NOT NULL CHECK(visibility IN ('PUBLIC','PRIVATE','INTERNAL')),
 default_branch text NOT NULL CHECK(length(default_branch) BETWEEN 1 AND 255), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,installation_id) REFERENCES public.lg_github_installations(organization_id,id),
 UNIQUE(installation_id,repository_id), UNIQUE(organization_id,id)
);
CREATE TABLE public.lg_repository_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, project_id uuid NOT NULL, repository_id uuid NOT NULL,
 application_root text NOT NULL DEFAULT '' CHECK(length(application_root)<=240 AND application_root !~ '(^/|\\|(^|/)\.\.(/|$))'),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DISCONNECTED')),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id),
 FOREIGN KEY(organization_id,repository_id) REFERENCES public.lg_installation_repositories(organization_id,id),
 UNIQUE(project_id,repository_id,application_root), UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_repository_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, project_id uuid NOT NULL, connection_id uuid NOT NULL,
 commit_sha text NOT NULL CHECK(commit_sha ~ '^[a-f0-9]{40}$'), tree_sha text CHECK(tree_sha ~ '^[a-f0-9]{40}$'),
 requested_by uuid NOT NULL REFERENCES auth.users(id), analysis_version text NOT NULL DEFAULT 'lg-static-1' CHECK(analysis_version='lg-static-1'),
 state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN ('QUEUED','RUNNING','COMPLETE','FAILED')),
 source_state text NOT NULL DEFAULT 'UNFETCHED' CHECK(source_state IN ('UNFETCHED','COMPLETE','PARTIAL')),
 failure_code text CHECK(failure_code IN ('INGESTION_FAILED','ANALYSIS_FAILED','ACCESS_REVOKED')),
 lease uuid, lease_expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,connection_id) REFERENCES public.lg_repository_connections(organization_id,project_id,id),
 UNIQUE(connection_id,commit_sha,analysis_version), UNIQUE(organization_id,project_id,id), UNIQUE(organization_id,id),
 CHECK(state<>'COMPLETE' OR (tree_sha IS NOT NULL AND source_state<>'UNFETCHED'))
);
CREATE TABLE public.lg_source_files (
 organization_id uuid NOT NULL, project_id uuid NOT NULL, snapshot_id uuid NOT NULL, path text NOT NULL CHECK(length(path) BETWEEN 1 AND 240),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'), blob_sha text NOT NULL CHECK(blob_sha ~ '^[a-f0-9]{40}$'),
 bytes integer NOT NULL CHECK(bytes BETWEEN 0 AND 65536), classification text NOT NULL CHECK(classification IN ('SOURCE','MANIFEST','MIGRATION','CONFIGURATION','GENERATED','BINARY','MEDIA','LOCKFILE','DOCUMENTATION','TEST','UNKNOWN')),
 PRIMARY KEY(snapshot_id,path), FOREIGN KEY(organization_id,project_id,snapshot_id) REFERENCES public.lg_repository_snapshots(organization_id,project_id,id)
);
CREATE TABLE public.lg_architecture_snapshots (
 snapshot_id uuid PRIMARY KEY, organization_id uuid NOT NULL, project_id uuid NOT NULL,
 report jsonb NOT NULL CHECK(jsonb_typeof(report)='object' AND octet_length(report::text)<=4194304 AND report->>'kind' IS NOT DISTINCT FROM 'STATIC_OBSERVATIONS'),
 report_digest text NOT NULL CHECK(report_digest ~ '^[a-f0-9]{64}$'), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,snapshot_id) REFERENCES public.lg_repository_snapshots(organization_id,project_id,id), UNIQUE(organization_id,project_id,snapshot_id)
);
CREATE TABLE public.lg_invariant_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, project_id uuid NOT NULL, snapshot_id uuid NOT NULL,
 proposal_key text NOT NULL CHECK(proposal_key ~ '^[a-f0-9]{32}$'), domain text NOT NULL CHECK(domain IN ('tenant_isolation','authorization','billing','webhooks','paid_features','ai_cost','authentication')),
 statement text NOT NULL CHECK(length(statement) BETWEEN 1 AND 2000), details jsonb NOT NULL CHECK(jsonb_typeof(details)='object' AND octet_length(details::text)<=32768 AND details @> '{"status":"PROPOSED","confirmationRequired":true}'::jsonb),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,snapshot_id) REFERENCES public.lg_architecture_snapshots(organization_id,project_id,snapshot_id),
 UNIQUE(snapshot_id,proposal_key), UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_invariant_confirmations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, project_id uuid NOT NULL, proposal_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), action text NOT NULL CHECK(action IN ('CONFIRM','REFINE','REJECT','DEFER')),
 statement text NOT NULL CHECK(length(statement) BETWEEN 1 AND 2000), actor_id uuid NOT NULL REFERENCES auth.users(id),
 request_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,proposal_id) REFERENCES public.lg_invariant_proposals(organization_id,project_id,id), UNIQUE(proposal_id,version), UNIQUE(proposal_id,request_key)
);
CREATE TABLE public.lg_integration_event_inbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL CHECK(provider='GITHUB'), mode text NOT NULL CHECK(mode='APP'),
 app_id bigint NOT NULL CHECK(app_id>0), delivery_id uuid NOT NULL, installation_id bigint CHECK(installation_id>0), organization_id uuid REFERENCES public.lg_organizations(id),
 event_type text NOT NULL CHECK(event_type IN ('installation','installation_repositories','repository','IGNORED')),
 action text NOT NULL CHECK(action IN ('REVOKE','IGNORE')), payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
 received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz NOT NULL DEFAULT now(), state text NOT NULL CHECK(state IN ('PROCESSED','IGNORED')),
 UNIQUE(provider,mode,app_id,delivery_id)
);
CREATE TABLE launchgate_private.github_setup_states (
 state_hash text PRIMARY KEY CHECK(state_hash ~ '^[a-f0-9]{64}$'), organization_id uuid NOT NULL, project_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id), installation_id bigint NOT NULL CHECK(installation_id>0), repository_id bigint NOT NULL CHECK(repository_id>0),
 application_root text NOT NULL CHECK(length(application_root)<=240), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes', consumed_at timestamptz,
 FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id)
);
REVOKE ALL ON launchgate_private.github_setup_states FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE launchgate_private.github_setup_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE launchgate_private.github_setup_states FORCE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lg_github_installations','lg_installation_repositories','lg_repository_connections','lg_repository_snapshots','lg_source_files','lg_architecture_snapshots','lg_invariant_proposals','lg_invariant_confirmations','lg_integration_event_inbox'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (launchgate_private.has_role(organization_id,ARRAY[''OWNER'',''ADMIN'',''DEVELOPER'',''VIEWER'']))',t||'_read',t);
 END LOOP;
END $$;
-- Backend lease values must not be exposed by snapshot list APIs or direct SQL.
REVOKE SELECT ON public.lg_repository_snapshots FROM authenticated;
GRANT SELECT(id,organization_id,project_id,connection_id,commit_sha,tree_sha,requested_by,analysis_version,state,source_state,failure_code,created_at,updated_at) ON public.lg_repository_snapshots TO authenticated;
CREATE TRIGGER lg_confirmation_append_only BEFORE UPDATE OR DELETE ON public.lg_invariant_confirmations FOR EACH ROW EXECUTE FUNCTION launchgate_private.reject_audit_mutation();
ALTER TABLE public.lg_audit_events DROP CONSTRAINT lg_audit_events_operation_check;
ALTER TABLE public.lg_audit_events ADD CONSTRAINT lg_audit_events_operation_check CHECK(operation IN ('ORGANIZATION_CREATED','MEMBER_ADDED','MEMBER_UPDATED','MEMBER_REMOVED','OWNERSHIP_TRANSFERRED','PROJECT_CREATED','RETENTION_UPDATED','DELETION_REQUESTED','GITHUB_SETUP_STARTED','GITHUB_CONNECTED','GITHUB_DISCONNECTED','SNAPSHOT_REQUESTED','INVARIANT_REVIEWED'));
ALTER TABLE public.lg_audit_events DROP CONSTRAINT lg_audit_events_target_type_check;
ALTER TABLE public.lg_audit_events ADD CONSTRAINT lg_audit_events_target_type_check CHECK(target_type IN ('ORGANIZATION','MEMBERSHIP','PROJECT','RETENTION_POLICY','DELETION_REQUEST','REPOSITORY_CONNECTION','SNAPSHOT','INVARIANT_PROPOSAL'));
COMMIT;
