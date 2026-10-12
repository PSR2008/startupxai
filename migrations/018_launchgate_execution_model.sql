BEGIN;
ALTER TABLE public.lg_repository_snapshots ADD UNIQUE(organization_id,project_id,id,commit_sha);
ALTER TABLE public.lg_invariant_confirmations ADD UNIQUE(organization_id,project_id,proposal_id,version);
CREATE TABLE public.lg_environments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),type text NOT NULL CHECK(type IN ('PREVIEW','STAGING','SANDBOX')),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED')),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id),UNIQUE(organization_id,project_id,id)
);
-- Provider credentials live in an operator secret store, never in these rows.
CREATE TABLE public.lg_vercel_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,
 account_id text NOT NULL,provider_project_id text NOT NULL,credential_reference uuid NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED')),
 FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id),UNIQUE(organization_id,project_id,id),
 UNIQUE(account_id,provider_project_id)
);
CREATE TABLE public.lg_deployments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,environment_id uuid NOT NULL,
 connection_id uuid NOT NULL,repository_connection_id uuid NOT NULL,provider text NOT NULL CHECK(provider='VERCEL'),
 provider_deployment_id text NOT NULL CHECK(provider_deployment_id ~ '^dpl_[A-Za-z0-9]+$'),
 target_url text NOT NULL CHECK(target_url ~ '^https://[a-z0-9-]+\.vercel\.app/$'),
 commit_sha text NOT NULL CHECK(commit_sha ~ '^[a-f0-9]{40}$'),verification_state text NOT NULL CHECK(verification_state='PROVIDER_VERIFIED'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,environment_id) REFERENCES public.lg_environments(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,connection_id) REFERENCES public.lg_vercel_connections(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,repository_connection_id) REFERENCES public.lg_repository_connections(organization_id,project_id,id),
 UNIQUE(organization_id,project_id,id),UNIQUE(organization_id,project_id,id,commit_sha),UNIQUE(connection_id,provider_deployment_id)
);
CREATE TABLE public.lg_authorization_proofs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,deployment_id uuid NOT NULL,
 method text NOT NULL CHECK(method='PROVIDER_OWNERSHIP_VERIFICATION'),digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 verified_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL CHECK(expires_at>verified_at AND expires_at<=verified_at+interval '24 hours'),
 revoked_at timestamptz,FOREIGN KEY(organization_id,project_id,deployment_id) REFERENCES public.lg_deployments(organization_id,project_id,id),
 UNIQUE(organization_id,project_id,deployment_id,id)
);
CREATE TABLE public.lg_target_authorizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,deployment_id uuid NOT NULL,proof_id uuid NOT NULL,
 principal_id uuid NOT NULL REFERENCES auth.users(id),principal_role text NOT NULL CHECK(principal_role IN ('OWNER','ADMIN')),
 version integer NOT NULL CHECK(version>0),starts_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 request_limit integer NOT NULL CHECK(request_limit BETWEEN 1 AND 1000),concurrency_limit integer NOT NULL CHECK(concurrency_limit BETWEEN 1 AND 2),
 duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 1 AND 900),spend_micros bigint NOT NULL DEFAULT 0 CHECK(spend_micros=0),
 data_policy text NOT NULL DEFAULT 'REDACTED_ONLY' CHECK(data_policy='REDACTED_ONLY'),payment_mode text NOT NULL DEFAULT 'TEST_ONLY' CHECK(payment_mode='TEST_ONLY'),
 revoked_at timestamptz,request_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at>starts_at AND expires_at<=starts_at+interval '24 hours'),
 FOREIGN KEY(organization_id,project_id,deployment_id,proof_id) REFERENCES public.lg_authorization_proofs(organization_id,project_id,deployment_id,id),
 UNIQUE(deployment_id,version),UNIQUE(project_id,request_key),UNIQUE(organization_id,project_id,id),UNIQUE(organization_id,project_id,deployment_id,version,id)
);
CREATE TABLE public.lg_target_allowlists (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,authorization_id uuid PRIMARY KEY,hostname text NOT NULL CHECK(hostname ~ '^[a-z0-9-]+\.vercel\.app$'),
 ports integer[] NOT NULL DEFAULT ARRAY[443] CHECK(ports=ARRAY[443]),operations text[] NOT NULL DEFAULT ARRAY['resource.read'] CHECK(operations=ARRAY['resource.read']),
 FOREIGN KEY(organization_id,project_id,authorization_id) REFERENCES public.lg_target_authorizations(organization_id,project_id,id)
);
CREATE TABLE public.lg_verification_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,snapshot_id uuid NOT NULL,deployment_id uuid NOT NULL,authorization_id uuid NOT NULL,
 authorization_version integer NOT NULL,commit_sha text NOT NULL CHECK(commit_sha ~ '^[a-f0-9]{40}$'),policy_version integer NOT NULL CHECK(policy_version=1),
 runner_version text NOT NULL DEFAULT 'lg-runner-1' CHECK(runner_version='lg-runner-1'),runner_image_digest text CHECK(runner_image_digest ~ '^sha256:[a-f0-9]{64}$'),
 requested_by uuid NOT NULL REFERENCES auth.users(id),request_key uuid NOT NULL,input_digest text NOT NULL,
 state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN ('QUEUED','PREPARING','RUNNING','CANCELLING','CANCELLED','COMPLETED','FAILED_INFRASTRUCTURE')),
 result text CHECK(result='UNOBSERVABLE'),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,snapshot_id,commit_sha) REFERENCES public.lg_repository_snapshots(organization_id,project_id,id,commit_sha),
 FOREIGN KEY(organization_id,project_id,deployment_id,commit_sha) REFERENCES public.lg_deployments(organization_id,project_id,id,commit_sha),
 FOREIGN KEY(organization_id,project_id,deployment_id,authorization_version,authorization_id) REFERENCES public.lg_target_authorizations(organization_id,project_id,deployment_id,version,id),
 UNIQUE(project_id,request_key),UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_run_invariants (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,run_id uuid NOT NULL,invariant_id uuid NOT NULL,version integer NOT NULL,statement text NOT NULL,
 PRIMARY KEY(run_id,invariant_id),FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,invariant_id,version) REFERENCES public.lg_invariant_confirmations(organization_id,project_id,proposal_id,version)
);
CREATE TABLE public.lg_run_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,run_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind ~ '^[A-Z_]{1,60}$'),attempt_id uuid,worker_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id)
);
CREATE TABLE public.lg_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,run_id uuid NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'READY' CHECK(state IN ('READY','LEASED','CLEANUP','DONE','DEAD','CANCELLED')),
 fence bigint NOT NULL DEFAULT 0,attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 3),available_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id),UNIQUE(organization_id,project_id,id),UNIQUE(organization_id,project_id,run_id,id)
);
CREATE TABLE public.lg_job_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,job_id uuid NOT NULL,run_id uuid NOT NULL,
 fence bigint NOT NULL,worker_id uuid NOT NULL,runner_id uuid NOT NULL,grant_id uuid NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'PREPARING' CHECK(state IN ('PREPARING','RUNNING','COMPLETED','FAILED','CANCELLED')),
 requests integer NOT NULL DEFAULT 0 CHECK(requests BETWEEN 0 AND 1000),reserved_requests integer NOT NULL,reserved_concurrency integer NOT NULL,
 cleanup_state text NOT NULL DEFAULT 'PENDING' CHECK(cleanup_state IN ('PENDING','RUNNING','COMPLETED')),
 started_at timestamptz NOT NULL DEFAULT now(),deadline timestamptz NOT NULL,finished_at timestamptz,next_request_at timestamptz NOT NULL DEFAULT '-infinity',
 FOREIGN KEY(organization_id,project_id,run_id,job_id) REFERENCES public.lg_jobs(organization_id,project_id,run_id,id),
 FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id),
 UNIQUE(job_id,fence),UNIQUE(organization_id,project_id,id),UNIQUE(organization_id,project_id,run_id,id)
);
CREATE TABLE public.lg_runner_leases (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,attempt_id uuid PRIMARY KEY,fence bigint NOT NULL,
 expires_at timestamptz NOT NULL,grant_consumed_at timestamptz,cleanup_worker uuid,cleanup_expires_at timestamptz,
 FOREIGN KEY(organization_id,project_id,attempt_id) REFERENCES public.lg_job_attempts(organization_id,project_id,id)
);
-- Organization-wide rolling daily ceiling. Project runs share this ceiling;
-- per-authorization ceilings additionally stop parallel runs for the same scope.
CREATE TABLE public.lg_execution_budgets (
 organization_id uuid PRIMARY KEY REFERENCES public.lg_organizations(id),window_start timestamptz NOT NULL DEFAULT now(),
 consumed integer NOT NULL DEFAULT 0,reserved integer NOT NULL DEFAULT 0,active integer NOT NULL DEFAULT 0,
 request_limit integer NOT NULL DEFAULT 1000 CHECK(request_limit BETWEEN 1 AND 1000),concurrency_limit integer NOT NULL DEFAULT 2 CHECK(concurrency_limit BETWEEN 1 AND 2),
 CHECK(consumed>=0 AND reserved>=0 AND active>=0 AND consumed+reserved<=request_limit AND active<=concurrency_limit)
);
CREATE TABLE public.lg_artifacts (
 id uuid PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,run_id uuid NOT NULL,attempt_id uuid NOT NULL,
 type text NOT NULL CHECK(type='PROBE_METADATA'),hash text NOT NULL CHECK(hash ~ '^sha256:[a-f0-9]{64}$'),size integer NOT NULL CHECK(size BETWEEN 0 AND 1048576),
 classification text NOT NULL CHECK(classification='INTERNAL'),redaction text NOT NULL CHECK(redaction='NO_SENSITIVE_DATA'),
 storage_reference text NOT NULL CHECK(storage_reference ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$'),expires_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,run_id,attempt_id) REFERENCES public.lg_job_attempts(organization_id,project_id,run_id,id),UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_evidence_manifests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,run_id uuid NOT NULL,attempt_id uuid NOT NULL UNIQUE,
 digest text NOT NULL CHECK(digest ~ '^sha256:[a-f0-9]{64}$'),manifest jsonb NOT NULL CHECK(octet_length(manifest::text)<=65536),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,run_id,attempt_id) REFERENCES public.lg_job_attempts(organization_id,project_id,run_id,id)
);
CREATE TABLE public.lg_observations (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,attempt_id uuid PRIMARY KEY,observations jsonb NOT NULL CHECK(octet_length(observations::text)<=4096),
 FOREIGN KEY(organization_id,project_id,attempt_id) REFERENCES public.lg_job_attempts(organization_id,project_id,id)
);
-- No attack assertions implemented: this foundation can record only UNOBSERVABLE.
CREATE TABLE public.lg_assertion_results (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,run_id uuid NOT NULL,invariant_id uuid NOT NULL,result text NOT NULL CHECK(result='UNOBSERVABLE'),
 PRIMARY KEY(run_id,invariant_id),FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id),
 FOREIGN KEY(run_id,invariant_id) REFERENCES public.lg_run_invariants(run_id,invariant_id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lg_environments','lg_vercel_connections','lg_deployments','lg_authorization_proofs','lg_target_authorizations','lg_target_allowlists','lg_verification_runs','lg_run_invariants','lg_run_events','lg_jobs','lg_job_attempts','lg_runner_leases','lg_execution_budgets','lg_artifacts','lg_evidence_manifests','lg_observations','lg_assertion_results'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  IF t NOT IN ('lg_runner_leases','lg_job_attempts','lg_execution_budgets','lg_vercel_connections') THEN
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
   EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (launchgate_private.has_role(organization_id,ARRAY[''OWNER'',''ADMIN'',''DEVELOPER'',''VIEWER'']))',t||'_read',t);
  END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['lg_deployments','lg_run_invariants','lg_run_events','lg_artifacts','lg_evidence_manifests','lg_observations','lg_assertion_results'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION launchgate_private.reject_audit_mutation()',t||'_immutable',t);
 END LOOP;
END $$;
COMMIT;
