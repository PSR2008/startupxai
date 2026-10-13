BEGIN;
ALTER TABLE public.lg_fixture_templates DROP CONSTRAINT lg_fixture_templates_family_check;
ALTER TABLE public.lg_fixture_templates ADD CONSTRAINT lg_fixture_templates_family_check CHECK(family IN ('auth_session_boundaries','tenant_isolation','privilege_escalation','billing_entitlements','webhook_integrity','ai_cost_controls','critical_browser_journeys'));
ALTER TABLE public.lg_target_allowlists DROP CONSTRAINT lg_target_allowlists_operations_check;
ALTER TABLE public.lg_target_allowlists ADD CONSTRAINT lg_target_allowlists_operations_check CHECK(operations=ARRAY['resource.read'] OR (hostname='reference-lab.invalid' AND operations IN (ARRAY['resource.read','resource.write','role.change','session.check'],ARRAY['payment.observe','webhook.deliver_test_event'],ARRAY['ai.invoke','quota.concurrent_attempt'],ARRAY['journey.execute_registered'])));
ALTER FUNCTION launchgate_private.lab_create(uuid,uuid,jsonb,uuid) RENAME TO lab_create_v6;
CREATE FUNCTION launchgate_private.lab_create(p_project uuid,p_actor uuid,p_data jsonb,p_replay uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE run_id uuid; run_row public.lg_verification_runs; existing boolean; family text:=p_data#>>'{plan,family}';
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.lg_verification_runs WHERE project_id=p_project AND request_key=(p_data->>'requestKey')::uuid) INTO existing;
 run_id:=launchgate_private.lab_create_v6(p_project,p_actor,p_data,p_replay);
 IF NOT existing AND family IN ('ai_cost_controls','critical_browser_journeys') THEN
  IF p_data#>>'{plan,budget,requests}' IS DISTINCT FROM '128' OR p_data#>>'{plan,budget,durationMs}' IS DISTINCT FROM '180000' OR p_data#>>'{plan,budget,concurrency}' NOT IN ('1','2') OR p_data#>>'{plan,budget,financialSpend}' IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'Phase 7 lab budget required' USING ERRCODE='22023';END IF;
  SELECT * INTO run_row FROM public.lg_verification_runs WHERE id=run_id;
  UPDATE public.lg_target_authorizations SET request_limit=128,duration_seconds=180,concurrency_limit=(p_data#>>'{plan,budget,concurrency}')::int WHERE id=run_row.authorization_id;
  UPDATE public.lg_target_allowlists SET operations=CASE WHEN family='ai_cost_controls' THEN ARRAY['ai.invoke','quota.concurrent_attempt'] ELSE ARRAY['journey.execute_registered'] END WHERE authorization_id=run_row.authorization_id;
 END IF;
 RETURN run_id;
END $$;
REVOKE ALL ON FUNCTION launchgate_private.lab_create(uuid,uuid,jsonb,uuid),launchgate_private.lab_create_v6(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
