BEGIN;
CREATE TABLE public.lg_operational_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, project_id uuid NOT NULL, run_id uuid NOT NULL, attempt_id uuid NOT NULL,
 environment text NOT NULL CHECK(environment IN ('development','test','staging','production')),
 kind text NOT NULL CHECK(kind IN ('SANDBOX','CREDENTIAL','ARTIFACT')), provider text NOT NULL CHECK(provider ~ '^[a-zA-Z0-9_-]{1,64}$'),
 external_id text NOT NULL CHECK(length(external_id)<=300 AND external_id ~ '^[a-zA-Z0-9/_-]+$'),
 expires_at timestamptz NOT NULL, state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','CLEANING','DESTROYED','DEAD_LETTER')),
 fence bigint NOT NULL DEFAULT 0, worker_id uuid, lease_until timestamptz, failures integer NOT NULL DEFAULT 0,
 FOREIGN KEY(organization_id,project_id,run_id,attempt_id) REFERENCES public.lg_job_attempts(organization_id,project_id,run_id,id),
 UNIQUE(environment,attempt_id,kind), UNIQUE(environment,provider,external_id,kind)
);
CREATE TABLE public.lg_provider_qualifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.lg_organizations(id),
 environment text NOT NULL CHECK(environment IN ('development','test','staging','production')),
 capability text NOT NULL CHECK(capability IN ('github.live','vercel.live','supabase.hosted','stripe.test','razorpay.test','openai.live','anthropic.live','sandbox.production','secrets.managed','artifacts.private','staging.e2e')),
 status text NOT NULL CHECK(status IN ('VERIFIED','UNVERIFIED','BLOCKED_BY_ENVIRONMENT','DEGRADED','NOT_IMPLEMENTED')),
 evidence_digest text CHECK(evidence_digest ~ '^sha256:[a-f0-9]{64}$'), live boolean NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 CHECK(expires_at>observed_at AND expires_at<=observed_at+interval '24 hours'),
 CHECK(status<>'VERIFIED' OR (live AND evidence_digest IS NOT NULL))
);
CREATE TABLE public.lg_operational_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.lg_organizations(id),
 resource_id uuid REFERENCES public.lg_operational_resources(id),
 kind text NOT NULL CHECK(kind IN ('RESOURCE_REGISTERED','RESOURCE_EXPIRED','RESOURCE_DESTROYED','CLEANUP_FAILURE','DEAD_LETTER','INTEGRATION_CONNECTED','INTEGRATION_VERIFIED','INTEGRATION_DEGRADED','INTEGRATION_REVOKED','READINESS_CHANGED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lg_operational_resources','lg_provider_qualifications','lg_operational_events'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t); EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (launchgate_private.has_role(organization_id,ARRAY[''OWNER'',''ADMIN'']))',t||'_read',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['lg_provider_qualifications','lg_operational_events'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION launchgate_private.reject_audit_mutation()',t||'_immutable',t);
 END LOOP;
END $$;
CREATE FUNCTION launchgate_private.operational_record(r public.lg_operational_resources) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',r.id,'scope',jsonb_build_object('environment',r.environment,'organizationId',r.organization_id,'runId',r.run_id,'attemptId',r.attempt_id),'kind',r.kind,'provider',r.provider,'externalId',r.external_id,'expiresAt',r.expires_at,'fence',r.fence);
$$;
CREATE FUNCTION public.lg_operations_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.lg_operational_resources; a public.lg_job_attempts; s jsonb:=p_data->'scope'; q public.lg_provider_qualifications; BEGIN
 IF p_action='REGISTER' THEN
  SELECT * INTO a FROM public.lg_job_attempts WHERE id=(s->>'attemptId')::uuid AND run_id=(s->>'runId')::uuid AND organization_id=(s->>'organizationId')::uuid;
  IF a.id IS NULL OR NOT ((p_data->>'expiresAt')::timestamptz>clock_timestamp()) OR (p_data->>'expiresAt')::timestamptz>clock_timestamp()+interval '7 days' THEN RAISE EXCEPTION 'resource scope';END IF;
  INSERT INTO public.lg_operational_resources(organization_id,project_id,run_id,attempt_id,environment,kind,provider,external_id,expires_at)
   VALUES(a.organization_id,a.project_id,a.run_id,a.id,s->>'environment',p_data->>'kind',p_data->>'provider',p_data->>'externalId',(p_data->>'expiresAt')::timestamptz)
   ON CONFLICT(environment,attempt_id,kind) DO NOTHING RETURNING * INTO r;
  IF r.id IS NULL THEN SELECT * INTO r FROM public.lg_operational_resources WHERE environment=s->>'environment' AND attempt_id=a.id AND kind=p_data->>'kind';
   IF r.provider IS DISTINCT FROM p_data->>'provider' OR r.external_id IS DISTINCT FROM p_data->>'externalId' OR r.state<>'ACTIVE' OR (r.kind<>'ARTIFACT' AND r.expires_at IS DISTINCT FROM (p_data->>'expiresAt')::timestamptz) THEN RAISE EXCEPTION 'resource identity conflict';END IF;
  ELSE INSERT INTO public.lg_operational_events(organization_id,resource_id,kind) VALUES(r.organization_id,r.id,'RESOURCE_REGISTERED');END IF;
  RETURN launchgate_private.operational_record(r);
 ELSIF p_action='ATTEMPT' THEN
  RETURN (SELECT coalesce(jsonb_agg(launchgate_private.operational_record(x)),'[]') FROM public.lg_operational_resources x WHERE x.attempt_id=(p_data->>'attemptId')::uuid AND x.environment=p_data->>'environment' AND x.kind='SANDBOX' AND x.state<>'DESTROYED');
 ELSIF p_action IN ('EXPIRE','DESTROYED') THEN
  SELECT * INTO r FROM public.lg_operational_resources WHERE environment=s->>'environment' AND organization_id=(s->>'organizationId')::uuid AND run_id=(s->>'runId')::uuid AND attempt_id=(s->>'attemptId')::uuid AND kind=p_data->>'kind' FOR UPDATE;
  IF r.id IS NULL THEN IF p_action='DESTROYED' THEN RETURN 'true';END IF;RAISE EXCEPTION 'resource scope';END IF;
  IF r.state<>'DESTROYED' THEN
   UPDATE public.lg_operational_resources SET expires_at=least(expires_at,clock_timestamp()),state=CASE WHEN p_action='DESTROYED' THEN 'DESTROYED' ELSE state END WHERE id=r.id;
   INSERT INTO public.lg_operational_events(organization_id,resource_id,kind) VALUES(r.organization_id,r.id,CASE WHEN p_action='DESTROYED' THEN 'RESOURCE_DESTROYED' ELSE 'RESOURCE_EXPIRED' END);
  END IF;RETURN 'true';
 ELSIF p_action='REAP_CLAIM' THEN
  SELECT * INTO r FROM public.lg_operational_resources WHERE environment=p_data->>'environment' AND ((state='ACTIVE' AND expires_at<=clock_timestamp()) OR (state='CLEANING' AND lease_until<=clock_timestamp())) ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF r.id IS NULL THEN RETURN NULL;END IF;
  UPDATE public.lg_operational_resources SET state='CLEANING',worker_id=(p_data->>'workerId')::uuid,fence=fence+1,lease_until=clock_timestamp()+interval '60 seconds' WHERE id=r.id RETURNING * INTO r;
  RETURN launchgate_private.operational_record(r);
 ELSIF p_action IN ('REAP_DONE','REAP_FAILED') THEN
  SELECT * INTO r FROM public.lg_operational_resources WHERE id=(p_data->>'id')::uuid AND worker_id=(p_data->>'workerId')::uuid AND fence=(p_data->>'fence')::bigint AND state='CLEANING' AND lease_until>clock_timestamp() FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'stale cleanup fence';END IF;
  UPDATE public.lg_operational_resources SET state=CASE WHEN p_action='REAP_DONE' THEN 'DESTROYED' WHEN failures>=4 THEN 'DEAD_LETTER' ELSE 'ACTIVE' END,failures=failures+CASE WHEN p_action='REAP_FAILED' THEN 1 ELSE 0 END,expires_at=CASE WHEN p_action='REAP_FAILED' THEN clock_timestamp()+interval '30 seconds' ELSE expires_at END WHERE id=r.id;
  INSERT INTO public.lg_operational_events(organization_id,resource_id,kind) VALUES(r.organization_id,r.id,CASE WHEN p_action='REAP_DONE' THEN 'RESOURCE_DESTROYED' WHEN r.failures>=4 THEN 'DEAD_LETTER' ELSE 'CLEANUP_FAILURE' END);RETURN 'true';
 ELSIF p_action='LEAKS' THEN RETURN (SELECT coalesce(jsonb_agg(launchgate_private.operational_record(x)),'[]') FROM public.lg_operational_resources x WHERE x.environment=p_data->>'environment' AND x.state<>'DESTROYED' AND x.expires_at<=clock_timestamp());
 ELSIF p_action='QUALIFY' THEN
  INSERT INTO public.lg_provider_qualifications(organization_id,environment,capability,status,evidence_digest,live,expires_at) VALUES((p_data->>'organizationId')::uuid,p_data->>'environment',p_data->>'capability',p_data->>'status',p_data->>'evidenceDigest',(p_data->>'live')::boolean,(p_data->>'expiresAt')::timestamptz) RETURNING * INTO q;
  INSERT INTO public.lg_operational_events(organization_id,kind) VALUES(q.organization_id,CASE WHEN q.status='VERIFIED' THEN 'INTEGRATION_VERIFIED' WHEN q.status='DEGRADED' THEN 'INTEGRATION_DEGRADED' ELSE 'READINESS_CHANGED' END); RETURN to_jsonb(q);
 ELSIF p_action='QUALIFICATIONS' THEN RETURN (SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.lg_provider_qualifications x WHERE x.organization_id=(p_data->>'organizationId')::uuid AND x.environment=p_data->>'environment');
 END IF;RAISE EXCEPTION 'unsupported operations action';
END $$;
REVOKE ALL ON FUNCTION launchgate_private.operational_record(public.lg_operational_resources),public.lg_operations_service(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_operations_service(text,jsonb) TO service_role;
COMMIT;
