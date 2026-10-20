BEGIN;
ALTER TABLE public.lg_provider_qualifications DROP CONSTRAINT lg_provider_qualifications_capability_check;
ALTER TABLE public.lg_provider_qualifications ADD CONSTRAINT lg_provider_qualifications_capability_check CHECK(capability IN (
 'github.live','vercel.live','supabase.hosted','stripe.test','razorpay.test','openai.live','anthropic.live','sandbox.production','secrets.managed','artifacts.private','staging.e2e',
 'github.checks.live','github.remediation.live','artifact_store.managed','secret_store.managed','staging.full_e2e','staging.deployment','staging.recovery','staging.cleanup','cli.windows.staging','github.action.live','assessment.external','sharing.external'));
ALTER TABLE public.lg_provider_qualifications ADD COLUMN configuration_digest text CHECK(configuration_digest ~ '^sha256:[a-f0-9]{64}$');
ALTER TABLE public.lg_provider_qualifications ADD COLUMN runtime_digest text CHECK(runtime_digest ~ '^sha256:[a-f0-9]{64}$');
ALTER TABLE public.lg_provider_qualifications ADD COLUMN safe_reason text NOT NULL DEFAULT 'LEGACY_UNQUALIFIED' CHECK(safe_reason IN ('LEGACY_UNQUALIFIED','ASSETS_MISSING','CONFIGURATION_INVALID','NOT_APPROVED','DRIVER_UNAVAILABLE','CONTRACT_ONLY','CHECKS_INCOMPLETE','LIVE_CHECKS_PASSED','PROVIDER_FAILURE','CLEANUP_FAILED','CONFIGURATION_CHANGED','BUDGET_UNBOUNDED'));
CREATE TABLE public.lg_qualification_configurations (
 organization_id uuid NOT NULL REFERENCES public.lg_organizations(id),
 environment text NOT NULL CHECK(environment IN ('staging','production')),
 configuration_digest text NOT NULL CHECK(configuration_digest ~ '^sha256:[a-f0-9]{64}$'),
 runtime_digest text NOT NULL CHECK(runtime_digest ~ '^sha256:[a-f0-9]{64}$'),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(organization_id,environment)
);
CREATE TABLE public.lg_qualification_budget_reservations (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.lg_organizations(id),
 phase integer NOT NULL CHECK(phase=13), provider text NOT NULL CHECK(provider IN ('openai','anthropic')),
 reserved_micro_usd integer NOT NULL CHECK(reserved_micro_usd BETWEEN 1 AND 100000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lg_qualification_configurations','lg_qualification_budget_reservations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING(launchgate_private.has_role(organization_id,ARRAY[''OWNER'',''ADMIN'']))',t||'_read',t);
 END LOOP;
END $$;
-- Reservations are never refunded automatically: an unknown provider outcome
-- consumes its full upper bound, including after a process crash or retry.
CREATE TRIGGER lg_qualification_budget_immutable BEFORE UPDATE OR DELETE ON public.lg_qualification_budget_reservations FOR EACH ROW EXECUTE FUNCTION launchgate_private.reject_audit_mutation();
ALTER FUNCTION public.lg_operations_service(text,jsonb) RENAME TO lg_operations_service_v12;
REVOKE ALL ON FUNCTION public.lg_operations_service_v12(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.lg_operations_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.lg_provider_qualifications; b public.lg_qualification_budget_reservations; d text; rd text; total bigint;
BEGIN
 IF p_action='QUALIFICATION_CONFIG' THEN
  INSERT INTO public.lg_qualification_configurations(organization_id,environment,configuration_digest,runtime_digest)
  VALUES((p_data->>'organizationId')::uuid,p_data->>'environment',p_data->>'configurationDigest',p_data->>'runtimeDigest')
  ON CONFLICT(organization_id,environment) DO UPDATE SET configuration_digest=excluded.configuration_digest,runtime_digest=excluded.runtime_digest,updated_at=clock_timestamp();
  INSERT INTO public.lg_operational_events(organization_id,kind) VALUES((p_data->>'organizationId')::uuid,'READINESS_CHANGED');
  RETURN '{}'::jsonb;
 ELSIF p_action='QUALIFICATION_BUDGET' THEN
  IF p_data->>'environment' IS DISTINCT FROM 'staging' OR p_data->>'provider' NOT IN ('openai','anthropic') THEN RAISE EXCEPTION 'diagnostic environment';END IF;
  PERFORM pg_advisory_xact_lock(130037);
  -- A consumed ticket must never authorize a second provider request.
  IF EXISTS(SELECT 1 FROM public.lg_qualification_budget_reservations WHERE id=(p_data->>'id')::uuid) THEN RAISE EXCEPTION 'diagnostic already reserved';END IF;
  SELECT coalesce(sum(reserved_micro_usd),0) INTO total FROM public.lg_qualification_budget_reservations WHERE phase=13 AND provider=p_data->>'provider';
  IF total+(p_data->>'reservedMicroUsd')::integer>100000 THEN RAISE EXCEPTION 'diagnostic budget exceeded';END IF;
  INSERT INTO public.lg_qualification_budget_reservations(id,organization_id,phase,provider,reserved_micro_usd)
  VALUES((p_data->>'id')::uuid,(p_data->>'organizationId')::uuid,13,p_data->>'provider',(p_data->>'reservedMicroUsd')::integer) RETURNING * INTO b;
  RETURN jsonb_build_object('id',b.id,'reservedMicroUsd',b.reserved_micro_usd);
 ELSIF p_action='QUALIFY' THEN
  IF p_data->>'status'='VERIFIED' THEN
   SELECT configuration_digest,runtime_digest INTO d,rd FROM public.lg_qualification_configurations WHERE organization_id=(p_data->>'organizationId')::uuid AND environment=p_data->>'environment';
   IF d IS NULL OR d IS DISTINCT FROM p_data->>'configurationDigest' OR rd IS DISTINCT FROM p_data->>'runtimeDigest' OR p_data->>'reason' IS DISTINCT FROM 'LIVE_CHECKS_PASSED' THEN RAISE EXCEPTION 'qualification configuration binding';END IF;
  END IF;
  INSERT INTO public.lg_provider_qualifications(organization_id,environment,capability,status,evidence_digest,live,expires_at,configuration_digest,runtime_digest,safe_reason)
  VALUES((p_data->>'organizationId')::uuid,p_data->>'environment',p_data->>'capability',p_data->>'status',p_data->>'evidenceDigest',(p_data->>'live')::boolean,(p_data->>'expiresAt')::timestamptz,p_data->>'configurationDigest',p_data->>'runtimeDigest',coalesce(p_data->>'reason','LEGACY_UNQUALIFIED')) RETURNING * INTO q;
  INSERT INTO public.lg_operational_events(organization_id,kind) VALUES(q.organization_id,CASE WHEN q.status='VERIFIED' THEN 'INTEGRATION_VERIFIED' WHEN q.status='DEGRADED' THEN 'INTEGRATION_DEGRADED' ELSE 'READINESS_CHANGED' END);
  RETURN to_jsonb(q);
 ELSIF p_action='QUALIFICATIONS' THEN
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object(
   'status',CASE WHEN x.status='VERIFIED' AND (x.expires_at<=clock_timestamp() OR c.configuration_digest IS NULL OR x.configuration_digest IS DISTINCT FROM c.configuration_digest OR x.runtime_digest IS DISTINCT FROM c.runtime_digest) THEN 'UNVERIFIED' ELSE x.status END,
   'freshness',CASE WHEN x.expires_at<=clock_timestamp() OR x.status='VERIFIED' AND (c.configuration_digest IS NULL OR x.configuration_digest IS DISTINCT FROM c.configuration_digest OR x.runtime_digest IS DISTINCT FROM c.runtime_digest) THEN 'STALE' ELSE 'CURRENT' END
  )),'[]') FROM public.lg_provider_qualifications x LEFT JOIN public.lg_qualification_configurations c ON c.organization_id=x.organization_id AND c.environment=x.environment
  WHERE x.organization_id=(p_data->>'organizationId')::uuid AND x.environment=p_data->>'environment');
 END IF;
 RETURN public.lg_operations_service_v12(p_action,p_data);
END $$;
REVOKE ALL ON FUNCTION public.lg_operations_service(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_operations_service(text,jsonb) TO service_role;
COMMIT;
