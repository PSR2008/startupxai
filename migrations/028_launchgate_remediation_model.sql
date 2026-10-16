BEGIN;
CREATE TABLE public.lg_fix_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,finding_id uuid NOT NULL,origin_run_id uuid NOT NULL,
 source_sha text NOT NULL CHECK(source_sha ~ '^[a-f0-9]{40}$'),policy_id uuid NOT NULL,policy_version integer NOT NULL,
 mode text NOT NULL CHECK(mode IN ('REFERENCE_LAB','GITHUB')),requested_by uuid NOT NULL REFERENCES auth.users(id),request_key uuid NOT NULL,
 state text NOT NULL DEFAULT 'PROPOSAL_REQUESTED' CHECK(state IN ('PROPOSAL_REQUESTED','GENERATING','PROPOSED','VALIDATING','READY_FOR_PR','PR_CREATED','WAITING_FOR_PREVIEW','VERIFYING','VERIFIED','VERIFICATION_FAILED','INCONCLUSIVE','STALE','REJECTED','SUPERSEDED')),
 next_action text CHECK(next_action IN ('GENERATE','VALIDATE','PR','VERIFY')),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,finding_id) REFERENCES public.lg_findings(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,origin_run_id) REFERENCES public.lg_verification_runs(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,policy_id,policy_version) REFERENCES public.lg_policy_versions(organization_id,project_id,policy_id,version),
 UNIQUE(project_id,request_key),UNIQUE(organization_id,project_id,id)
);
CREATE TABLE public.lg_patch_artifacts (
 proposal_id uuid PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,context jsonb NOT NULL CHECK(octet_length(context::text)<=300000),proposal jsonb NOT NULL CHECK(octet_length(proposal::text)<=50000),
 patch_hash text NOT NULL CHECK(patch_hash ~ '^sha256:[a-f0-9]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,proposal_id) REFERENCES public.lg_fix_proposals(organization_id,project_id,id)
);
CREATE TABLE public.lg_fix_pull_requests (
 proposal_id uuid PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,mode text NOT NULL CHECK(mode IN ('REFERENCE_LAB','GITHUB')),
 branch text NOT NULL CHECK(branch ~ '^launchgate/fix/[a-f0-9-]{36}-[a-f0-9-]{36}$'),fix_sha text NOT NULL CHECK(fix_sha ~ '^[a-f0-9]{40}$'),
 provider_reference text NOT NULL CHECK(length(provider_reference)<=200),requested_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,proposal_id) REFERENCES public.lg_fix_proposals(organization_id,project_id,id)
);
CREATE TABLE public.lg_fix_verification_runs (
 proposal_id uuid PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,release_id uuid NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'VERIFYING' CHECK(state IN ('VERIFYING','VERIFIED','VERIFICATION_FAILED','INCONCLUSIVE')),
 evidence jsonb CHECK(octet_length(evidence::text)<=1048576),manifest_digest text CHECK(manifest_digest ~ '^sha256:[a-f0-9]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,proposal_id) REFERENCES public.lg_fix_proposals(organization_id,project_id,id),
 FOREIGN KEY(organization_id,project_id,release_id) REFERENCES public.lg_release_candidates(organization_id,project_id,id)
);
CREATE TABLE public.lg_remediation_capabilities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,project_id uuid NOT NULL,connection_id uuid NOT NULL,
 app_id bigint NOT NULL,installation_id bigint NOT NULL,repository_id bigint NOT NULL,enabled boolean NOT NULL DEFAULT false,
 verified_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,revoked_at timestamptz,
 FOREIGN KEY(organization_id,project_id,connection_id) REFERENCES public.lg_repository_connections(organization_id,project_id,id),
 UNIQUE(organization_id,project_id,id),CHECK(expires_at>verified_at AND expires_at<=verified_at+interval '1 hour')
);
CREATE TABLE public.lg_fix_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id uuid NOT NULL,project_id uuid NOT NULL,proposal_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),kind text NOT NULL CHECK(kind ~ '^[A-Z_]{1,60}$'),request_key uuid,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,project_id,proposal_id) REFERENCES public.lg_fix_proposals(organization_id,project_id,id),UNIQUE(proposal_id,kind,request_key)
);
CREATE TABLE launchgate_private.fix_leases (proposal_id uuid PRIMARY KEY REFERENCES public.lg_fix_proposals(id),worker_id uuid NOT NULL,fence bigint NOT NULL DEFAULT 1,expires_at timestamptz NOT NULL);
CREATE TABLE launchgate_private.fix_requests (proposal_id uuid NOT NULL REFERENCES public.lg_fix_proposals(id),action text NOT NULL,request_key uuid NOT NULL,actor_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(proposal_id,action,request_key));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lg_fix_proposals','lg_patch_artifacts','lg_fix_pull_requests','lg_fix_verification_runs','lg_remediation_capabilities','lg_fix_events'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t); EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (launchgate_private.has_role(organization_id,ARRAY[''OWNER'',''ADMIN'',''DEVELOPER'',''VIEWER'']))',t||'_read',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['lg_patch_artifacts','lg_fix_pull_requests','lg_fix_events'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION launchgate_private.reject_audit_mutation()',t||'_immutable',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['fix_leases','fix_requests'] LOOP
  EXECUTE format('ALTER TABLE launchgate_private.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE launchgate_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON launchgate_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
-- Existing exact replay must not resolve a remediation before adjacent coverage.
CREATE FUNCTION launchgate_private.hold_fix_resolution() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.state='RESOLVED' AND EXISTS(SELECT 1 FROM public.lg_release_runs rr JOIN public.lg_fix_verification_runs fv ON fv.release_id=rr.release_id WHERE rr.run_id=NEW.active_replay AND fv.state<>'VERIFIED') THEN NEW.state:='FIX_VERIFICATION';END IF;RETURN NEW;
END $$;
CREATE TRIGGER lg_fix_resolution_guard BEFORE UPDATE ON public.lg_findings FOR EACH ROW EXECUTE FUNCTION launchgate_private.hold_fix_resolution();
CREATE FUNCTION launchgate_private.hold_fix_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.state='RESOLVED' AND EXISTS(SELECT 1 FROM public.lg_release_runs rr JOIN public.lg_fix_verification_runs fv ON fv.release_id=rr.release_id WHERE rr.run_id=NEW.run_id AND fv.state<>'VERIFIED') THEN NEW.state:='FIX_VERIFICATION';END IF;RETURN NEW;
END $$;
CREATE TRIGGER lg_fix_event_guard BEFORE INSERT ON public.lg_finding_events FOR EACH ROW EXECUTE FUNCTION launchgate_private.hold_fix_event();
REVOKE ALL ON FUNCTION launchgate_private.hold_fix_resolution(),launchgate_private.hold_fix_event() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
