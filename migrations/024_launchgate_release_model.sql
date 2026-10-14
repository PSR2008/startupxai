BEGIN;
CREATE TABLE public.lg_verification_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id),UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_policy_versions (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,policy_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 policy jsonb NOT NULL CHECK(octet_length(policy::text)<=1048576),invariant_set_digest text NOT NULL CHECK(invariant_set_digest ~ '^sha256:[a-f0-9]{64}$'),
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(policy_id,version),
 FOREIGN KEY(organization_id,project_id,policy_id) REFERENCES public.lg_verification_policies(organization_id,project_id,id),UNIQUE(organization_id,project_id,policy_id,version),
 CHECK(policy->>'id'=policy_id::text AND (policy->>'version')::int=version AND policy->>'minimumCoverage'='1' AND policy->>'requiredInconclusive'='NON_APPROVAL')
);
CREATE TABLE public.lg_policy_invariants (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,policy_id uuid NOT NULL,policy_version integer NOT NULL,invariant_id uuid NOT NULL,invariant_version integer NOT NULL,
 requirement jsonb NOT NULL CHECK(octet_length(requirement::text)<=32768),PRIMARY KEY(policy_id,policy_version,invariant_id),
 FOREIGN KEY(organization_id,project_id,policy_id,policy_version) REFERENCES public.lg_policy_versions(organization_id,project_id,policy_id,version)
);
CREATE TABLE public.lg_release_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,connection_id uuid,snapshot_id uuid,deployment_id uuid NOT NULL,
 commit_sha text NOT NULL CHECK(commit_sha ~ '^[a-f0-9]{40}$'),policy_id uuid NOT NULL,policy_version integer NOT NULL,
 identity jsonb NOT NULL CHECK(octet_length(identity::text)<=16384),requested_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,connection_id) REFERENCES public.lg_repository_connections(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,snapshot_id,commit_sha) REFERENCES public.lg_repository_snapshots(organization_id,project_id,id,commit_sha),
 FOREIGN KEY(organization_id,project_id,deployment_id,commit_sha) REFERENCES public.lg_deployments(organization_id,project_id,id,commit_sha),
 FOREIGN KEY(organization_id,project_id,policy_id,policy_version) REFERENCES public.lg_policy_versions(organization_id,project_id,policy_id,version),
 UNIQUE(project_id,commit_sha,deployment_id,policy_id,policy_version),UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_release_states (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,release_id uuid PRIMARY KEY,state text NOT NULL DEFAULT 'READY' CHECK(state IN ('DISCOVERED','WAITING_FOR_DEPLOYMENT','READY','VERIFYING','EVALUATING','DECIDED','SUPERSEDED','CANCELLED')),
 generation integer NOT NULL DEFAULT 1,selection jsonb,actual_cost numeric NOT NULL DEFAULT 0,duration_ms bigint NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,project_id,release_id) REFERENCES public.lg_release_candidates(organization_id,project_id,id)
);
CREATE TABLE public.lg_release_runs (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,release_id uuid NOT NULL,invariant_id uuid NOT NULL,generation integer NOT NULL,run_id uuid NOT NULL,
 PRIMARY KEY(release_id,generation,invariant_id),UNIQUE(run_id),
 FOREIGN KEY(organization_id,project_id,release_id) REFERENCES public.lg_release_candidates(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id)
);
CREATE TABLE public.lg_policy_exceptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,release_id uuid NOT NULL,invariant_id uuid NOT NULL,finding_id uuid,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),actor_id uuid NOT NULL REFERENCES auth.users(id),actor_role text NOT NULL CHECK(actor_role IN ('OWNER','ADMIN')),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,revoked_at timestamptz,ticket text CHECK(length(ticket)<=500),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '30 days'),
 FOREIGN KEY(organization_id,project_id,release_id) REFERENCES public.lg_release_candidates(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,finding_id) REFERENCES public.lg_findings(organization_id,project_id,id)
);
CREATE TABLE public.lg_invariant_dependencies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,policy_id uuid NOT NULL,policy_version integer NOT NULL,invariant_id uuid NOT NULL,
 snapshot_id uuid NOT NULL,mapping jsonb NOT NULL CHECK(octet_length(mapping::text)<=65536),
 FOREIGN KEY(policy_id,policy_version,invariant_id) REFERENCES public.lg_policy_invariants(policy_id,policy_version,invariant_id),
 FOREIGN KEY(organization_id,project_id,policy_id,policy_version) REFERENCES public.lg_policy_versions(organization_id,project_id,policy_id,version),
 FOREIGN KEY(organization_id,project_id,snapshot_id) REFERENCES public.lg_repository_snapshots(organization_id,project_id,id)
);
CREATE TABLE public.lg_regression_dependencies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,finding_id uuid NOT NULL,snapshot_id uuid NOT NULL,
 mapping jsonb NOT NULL CHECK(octet_length(mapping::text)<=65536),
 FOREIGN KEY(organization_id,project_id,finding_id) REFERENCES public.lg_findings(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,snapshot_id) REFERENCES public.lg_repository_snapshots(organization_id,project_id,id)
);
CREATE TABLE public.lg_gate_evaluations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,release_id uuid NOT NULL,generation integer NOT NULL,
 decision text NOT NULL CHECK(decision IN ('SHIP','BLOCK','INCONCLUSIVE')),evaluation jsonb NOT NULL CHECK(octet_length(evaluation::text)<=2097152),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,release_id) REFERENCES public.lg_release_candidates(organization_id,project_id,id),UNIQUE(release_id,generation),UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_gate_evaluation_items (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,evaluation_id uuid NOT NULL,invariant_id uuid NOT NULL,status text NOT NULL CHECK(status IN ('PASS','REPRODUCIBLE_FAILURE','INCONCLUSIVE','NOT_APPLICABLE','NOT_RUN','STALE')),
 item jsonb NOT NULL,PRIMARY KEY(evaluation_id,invariant_id),FOREIGN KEY(organization_id,project_id,evaluation_id) REFERENCES public.lg_gate_evaluations(organization_id,project_id,id)
);
CREATE TABLE public.lg_github_check_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,connection_id uuid NOT NULL,head_sha text NOT NULL CHECK(head_sha ~ '^[a-f0-9]{40}$'),
 evaluation_id uuid NOT NULL,check_id bigint,publication_state text NOT NULL DEFAULT 'PENDING' CHECK(publication_state IN ('PENDING','PUBLISHED','SUPERSEDED')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(evaluation_id),
 FOREIGN KEY(organization_id,project_id,connection_id) REFERENCES public.lg_repository_connections(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,evaluation_id) REFERENCES public.lg_gate_evaluations(organization_id,project_id,id)
);
CREATE TABLE public.lg_release_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,release_id uuid,kind text NOT NULL CHECK(kind ~ '^[A-Z_]{1,60}$'),
 actor_id uuid NOT NULL REFERENCES auth.users(id),reference_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id),
 FOREIGN KEY(organization_id,project_id,release_id) REFERENCES public.lg_release_candidates(organization_id,project_id,id)
);
CREATE TABLE public.lg_release_configurations (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,connection_id uuid PRIMARY KEY,policy_id uuid NOT NULL,policy_version integer NOT NULL,environment_id uuid NOT NULL,
 requested_by uuid NOT NULL REFERENCES auth.users(id),enabled boolean NOT NULL DEFAULT true,
 FOREIGN KEY(organization_id,project_id,connection_id) REFERENCES public.lg_repository_connections(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,policy_id,policy_version) REFERENCES public.lg_policy_versions(organization_id,project_id,policy_id,version),
 FOREIGN KEY(organization_id,project_id,environment_id) REFERENCES public.lg_environments(organization_id,project_id,id)
);
CREATE TABLE launchgate_private.release_leases (
 release_id uuid PRIMARY KEY REFERENCES public.lg_release_candidates(id),worker_id uuid NOT NULL,fence bigint NOT NULL DEFAULT 1,expires_at timestamptz NOT NULL
);
CREATE TABLE launchgate_private.release_deliveries (
 app_id bigint NOT NULL,delivery_id uuid NOT NULL,installation_id bigint NOT NULL,repository_id bigint NOT NULL,head_sha text NOT NULL CHECK(head_sha ~ '^[a-f0-9]{40}$'),base_sha text,
 pull_request integer,payload_digest text NOT NULL,rerun boolean NOT NULL DEFAULT false,state text NOT NULL DEFAULT 'WAITING_FOR_DEPLOYMENT',created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(app_id,delivery_id)
);
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['lg_verification_policies','lg_policy_versions','lg_policy_invariants','lg_release_candidates','lg_release_states','lg_release_runs','lg_policy_exceptions','lg_invariant_dependencies','lg_regression_dependencies','lg_gate_evaluations','lg_gate_evaluation_items','lg_github_check_runs','lg_release_events','lg_release_configurations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (launchgate_private.has_role(organization_id,ARRAY[''OWNER'',''ADMIN'',''DEVELOPER'',''VIEWER'']))',t||'_read',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['lg_verification_policies','lg_policy_versions','lg_policy_invariants','lg_release_candidates','lg_release_runs','lg_invariant_dependencies','lg_regression_dependencies','lg_gate_evaluations','lg_gate_evaluation_items','lg_release_events'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION launchgate_private.reject_audit_mutation()',t||'_immutable',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['release_leases','release_deliveries'] LOOP
  EXECUTE format('ALTER TABLE launchgate_private.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE launchgate_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON launchgate_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
COMMIT;
