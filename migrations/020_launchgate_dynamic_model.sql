BEGIN;
ALTER TABLE public.lg_artifacts DROP CONSTRAINT lg_artifacts_type_check;
ALTER TABLE public.lg_artifacts ADD CHECK(type IN ('PROBE_METADATA','REFERENCE_LAB_TRACE'));
-- Lab identity is explicit. No forged GitHub/Vercel installation or source scan.
ALTER TABLE public.lg_deployments ALTER COLUMN connection_id DROP NOT NULL,ALTER COLUMN repository_connection_id DROP NOT NULL;
ALTER TABLE public.lg_deployments DROP CONSTRAINT lg_deployments_provider_check;
ALTER TABLE public.lg_deployments ADD CHECK(provider IN ('VERCEL','REFERENCE_LAB'));
ALTER TABLE public.lg_deployments DROP CONSTRAINT lg_deployments_target_url_check;
ALTER TABLE public.lg_deployments ADD CHECK((provider='VERCEL' AND connection_id IS NOT NULL AND repository_connection_id IS NOT NULL AND target_url ~ '^https://[a-z0-9-]+\.vercel\.app/$') OR (provider='REFERENCE_LAB' AND connection_id IS NULL AND repository_connection_id IS NULL AND target_url='https://reference-lab.invalid/'));
ALTER TABLE public.lg_deployments DROP CONSTRAINT lg_deployments_verification_state_check;
ALTER TABLE public.lg_deployments ADD CHECK((provider='VERCEL' AND verification_state='PROVIDER_VERIFIED') OR (provider='REFERENCE_LAB' AND verification_state='HARNESS_CONTROLLED'));
ALTER TABLE public.lg_authorization_proofs DROP CONSTRAINT lg_authorization_proofs_method_check;
ALTER TABLE public.lg_authorization_proofs ADD CHECK(method IN ('PROVIDER_OWNERSHIP_VERIFICATION','REFERENCE_LAB_HARNESS'));
ALTER TABLE public.lg_target_allowlists DROP CONSTRAINT lg_target_allowlists_hostname_check;
ALTER TABLE public.lg_target_allowlists ADD CHECK(hostname ~ '^[a-z0-9-]+\.vercel\.app$' OR hostname='reference-lab.invalid');
ALTER TABLE public.lg_target_allowlists DROP CONSTRAINT lg_target_allowlists_operations_check;
ALTER TABLE public.lg_target_allowlists ADD CHECK(operations=ARRAY['resource.read'] OR (hostname='reference-lab.invalid' AND operations=ARRAY['resource.read','resource.write','role.change','session.check']));
ALTER TABLE public.lg_verification_runs ALTER COLUMN snapshot_id DROP NOT NULL;
ALTER TABLE public.lg_verification_runs ADD COLUMN purpose text NOT NULL DEFAULT 'CUSTOMER_VERIFICATION' CHECK(purpose IN ('CUSTOMER_VERIFICATION','REFERENCE_LAB'));
ALTER TABLE public.lg_verification_runs ADD CHECK(purpose='REFERENCE_LAB' OR snapshot_id IS NOT NULL);
ALTER TABLE public.lg_verification_runs DROP CONSTRAINT lg_verification_runs_result_check;
ALTER TABLE public.lg_verification_runs ADD CHECK(result IN ('UNOBSERVABLE','PASS','REPRODUCIBLE_FAILURE','INCONCLUSIVE'));
ALTER TABLE public.lg_observations DROP CONSTRAINT lg_observations_observations_check;
ALTER TABLE public.lg_observations ADD CHECK(octet_length(observations::text)<=65536);
ALTER TABLE public.lg_assertion_results DROP CONSTRAINT lg_assertion_results_result_check;
ALTER TABLE public.lg_assertion_results ADD CHECK(result IN ('UNOBSERVABLE','PASS','REPRODUCIBLE_FAILURE','INCONCLUSIVE'));
ALTER TABLE public.lg_assertion_results ADD COLUMN assertions jsonb NOT NULL DEFAULT '[]' CHECK(octet_length(assertions::text)<=8192);
ALTER TABLE public.lg_assertion_results DROP CONSTRAINT lg_assertion_results_run_id_invariant_id_fkey;
CREATE TABLE public.lg_fixture_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,
 family text NOT NULL CHECK(family IN ('auth_session_boundaries','tenant_isolation','privilege_escalation')),version integer NOT NULL CHECK(version=1),
 variant text NOT NULL CHECK(variant IN ('vulnerable','fixed','inconclusive')),source_digest text NOT NULL CHECK(source_digest ~ '^sha256:[a-f0-9]{64}$'),
 FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id),UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_test_cases (
 run_id uuid PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,template_id uuid NOT NULL,invariant_id uuid NOT NULL,invariant_version integer NOT NULL CHECK(invariant_version>0),
 plan jsonb NOT NULL CHECK(octet_length(plan::text)<=16384),plan_hash text NOT NULL CHECK(plan_hash ~ '^sha256:[a-f0-9]{64}$'),seed text NOT NULL CHECK(seed ~ '^[A-Za-z0-9_-]{1,60}$'),
 replay_of uuid,FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,template_id) REFERENCES public.lg_fixture_templates(organization_id,project_id,id),UNIQUE(organization_id,project_id,run_id),UNIQUE(run_id,invariant_id)
);
CREATE TABLE public.lg_fixture_sets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,run_id uuid NOT NULL,attempt_id uuid NOT NULL,seed text NOT NULL,
 cleanup text NOT NULL CHECK(cleanup IN ('COMPLETED','FAILED')),FOREIGN KEY(organization_id,project_id,run_id,attempt_id) REFERENCES public.lg_job_attempts(organization_id,project_id,run_id,id),
 UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_test_identities (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,fixture_set_id uuid NOT NULL,logical_name text NOT NULL,concrete_id uuid NOT NULL,
 PRIMARY KEY(fixture_set_id,logical_name),FOREIGN KEY(organization_id,project_id,fixture_set_id) REFERENCES public.lg_fixture_sets(organization_id,project_id,id)
);
CREATE TABLE public.lg_synthetic_resources (LIKE public.lg_test_identities INCLUDING ALL);
ALTER TABLE public.lg_synthetic_resources ADD FOREIGN KEY(organization_id,project_id,fixture_set_id) REFERENCES public.lg_fixture_sets(organization_id,project_id,id);
CREATE TABLE public.lg_test_attempts (
 id uuid PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,run_id uuid NOT NULL,attempt_id uuid NOT NULL,fixture_set_id uuid NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal IN (1,2)),trace jsonb NOT NULL CHECK(octet_length(trace::text)<=32768),trace_digest text NOT NULL CHECK(trace_digest ~ '^sha256:[a-f0-9]{64}$'),
 FOREIGN KEY(organization_id,project_id,run_id,attempt_id) REFERENCES public.lg_job_attempts(organization_id,project_id,run_id,id),
 FOREIGN KEY(organization_id,project_id,fixture_set_id) REFERENCES public.lg_fixture_sets(organization_id,project_id,id),UNIQUE(attempt_id,ordinal)
);
CREATE TABLE public.lg_findings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,invariant_id uuid NOT NULL,invariant_version integer NOT NULL,
 signature text NOT NULL CHECK(signature ~ '^sha256:[a-f0-9]{64}$'),plan_hash text NOT NULL CHECK(plan_hash ~ '^sha256:[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('CANDIDATE','REPRODUCING','REPRODUCED','FIX_PENDING','FIX_VERIFICATION','RESOLVED','REGRESSION_FAILED','DISMISSED','INCONCLUSIVE')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),active_replay uuid,
 FOREIGN KEY(organization_id,project_id,active_replay) REFERENCES public.lg_verification_runs(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id) REFERENCES public.lg_projects(organization_id,id),UNIQUE(organization_id,project_id,signature),UNIQUE(organization_id,project_id,id)
);
ALTER TABLE public.lg_test_cases ADD FOREIGN KEY(organization_id,project_id,replay_of) REFERENCES public.lg_findings(organization_id,project_id,id);
CREATE TABLE public.lg_finding_occurrences (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,finding_id uuid NOT NULL,run_id uuid NOT NULL,attempt_id uuid NOT NULL,outcome text NOT NULL CHECK(outcome IN ('PASS','REPRODUCIBLE_FAILURE','INCONCLUSIVE')),
 PRIMARY KEY(finding_id,run_id),FOREIGN KEY(organization_id,project_id,finding_id) REFERENCES public.lg_findings(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,run_id,attempt_id) REFERENCES public.lg_job_attempts(organization_id,project_id,run_id,id)
);
CREATE TABLE public.lg_finding_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,finding_id uuid NOT NULL,run_id uuid NOT NULL,state text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,finding_id) REFERENCES public.lg_findings(organization_id,project_id,id),FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id)
);
CREATE TABLE public.lg_reproduction_bundles (
 organization_id uuid NOT NULL,project_id uuid NOT NULL,run_id uuid PRIMARY KEY,attempt_id uuid NOT NULL,manifest_digest text NOT NULL CHECK(manifest_digest ~ '^sha256:[a-f0-9]{64}$'),
 bundle jsonb NOT NULL CHECK(octet_length(bundle::text)<=65536),
 FOREIGN KEY(organization_id,project_id,run_id,attempt_id) REFERENCES public.lg_job_attempts(organization_id,project_id,run_id,id)
);
CREATE TABLE public.lg_replay_attempts (
 run_id uuid PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,finding_id uuid NOT NULL,request_key uuid NOT NULL,
 FOREIGN KEY(organization_id,project_id,run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id),FOREIGN KEY(organization_id,project_id,finding_id) REFERENCES public.lg_findings(organization_id,project_id,id),UNIQUE(project_id,request_key)
);
CREATE TABLE public.lg_regression_tests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,finding_id uuid NOT NULL UNIQUE,
 artifact jsonb NOT NULL CHECK(octet_length(artifact::text)<=32768),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,finding_id) REFERENCES public.lg_findings(organization_id,project_id,id)
);
CREATE FUNCTION launchgate_private.assertion_parent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.lg_run_invariants WHERE run_id=NEW.run_id AND invariant_id=NEW.invariant_id) AND NOT EXISTS(SELECT 1 FROM public.lg_test_cases WHERE run_id=NEW.run_id AND invariant_id=NEW.invariant_id) THEN RAISE EXCEPTION 'assertion parent' USING ERRCODE='23503'; END IF;RETURN NEW;END $$;
CREATE TRIGGER lg_assertion_parent BEFORE INSERT ON public.lg_assertion_results FOR EACH ROW EXECUTE FUNCTION launchgate_private.assertion_parent();
REVOKE ALL ON FUNCTION launchgate_private.assertion_parent() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lg_fixture_templates','lg_test_cases','lg_fixture_sets','lg_test_identities','lg_synthetic_resources','lg_test_attempts','lg_findings','lg_finding_occurrences','lg_finding_events','lg_reproduction_bundles','lg_replay_attempts','lg_regression_tests'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (launchgate_private.has_role(organization_id,ARRAY[''OWNER'',''ADMIN'',''DEVELOPER'',''VIEWER'']))',t||'_read',t);
  IF t<>'lg_findings' THEN EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION launchgate_private.reject_audit_mutation()',t||'_immutable',t);END IF;
 END LOOP;
END $$;
COMMIT;
