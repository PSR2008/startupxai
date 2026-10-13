BEGIN;
-- Billing stays in the existing lab/evidence model, never customer billing tables.
ALTER TABLE public.lg_fixture_templates DROP CONSTRAINT lg_fixture_templates_family_check;
ALTER TABLE public.lg_fixture_templates ADD CHECK(family IN ('auth_session_boundaries','tenant_isolation','privilege_escalation','billing_entitlements','webhook_integrity'));
-- Phase 5's multi-column CHECK has a PostgreSQL-generated name. Resolve it
-- by its operations dependency, and fail closed if the expected schema differs.
DO $$ DECLARE constraints text[]; BEGIN
 SELECT array_agg(c.conname) INTO constraints FROM pg_constraint c
 JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
 WHERE c.conrelid='public.lg_target_allowlists'::regclass AND c.contype='c' AND a.attname='operations';
 IF cardinality(constraints) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'expected one operations constraint'; END IF;
 EXECUTE format('ALTER TABLE public.lg_target_allowlists DROP CONSTRAINT %I',constraints[1]);
END $$;
ALTER TABLE public.lg_target_allowlists ADD CONSTRAINT lg_target_allowlists_operations_check CHECK(operations=ARRAY['resource.read'] OR (hostname='reference-lab.invalid' AND (operations=ARRAY['resource.read','resource.write','role.change','session.check'] OR operations=ARRAY['payment.observe','webhook.deliver_test_event'])));
ALTER FUNCTION launchgate_private.lab_create(uuid,uuid,jsonb,uuid) RENAME TO lab_create_v5;
CREATE FUNCTION launchgate_private.lab_create(p_project uuid,p_actor uuid,p_data jsonb,p_replay uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE run_id uuid;run_row public.lg_verification_runs;existing boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.lg_verification_runs WHERE project_id=p_project AND request_key=(p_data->>'requestKey')::uuid) INTO existing;
 run_id:=launchgate_private.lab_create_v5(p_project,p_actor,p_data,p_replay);
 IF NOT existing AND p_data#>>'{plan,family}' IN ('billing_entitlements','webhook_integrity') THEN
  IF p_data#>>'{plan,budget,requests}' IS DISTINCT FROM '64' OR p_data#>>'{plan,budget,durationMs}' IS DISTINCT FROM '120000' OR p_data#>>'{plan,budget,concurrency}' NOT IN ('1','2') THEN RAISE EXCEPTION 'billing lab budget required' USING ERRCODE='22023';END IF;
  SELECT * INTO run_row FROM public.lg_verification_runs WHERE id=run_id;
  UPDATE public.lg_target_authorizations SET request_limit=64,duration_seconds=120,concurrency_limit=(p_data#>>'{plan,budget,concurrency}')::int WHERE id=run_row.authorization_id;
  UPDATE public.lg_target_allowlists SET operations=ARRAY['payment.observe','webhook.deliver_test_event'] WHERE authorization_id=run_row.authorization_id;
 END IF;
 RETURN run_id;
END $$;
REVOKE ALL ON FUNCTION launchgate_private.lab_create(uuid,uuid,jsonb,uuid),launchgate_private.lab_create_v5(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
