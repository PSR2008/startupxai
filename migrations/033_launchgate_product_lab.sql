BEGIN;
ALTER TABLE public.lg_projects ADD COLUMN purpose text NOT NULL DEFAULT 'CUSTOMER_VERIFICATION' CHECK(purpose IN ('CUSTOMER_VERIFICATION','REFERENCE_LAB'));
CREATE FUNCTION launchgate_private.project_purpose_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.purpose<>OLD.purpose THEN RAISE EXCEPTION 'project purpose immutable' USING ERRCODE='42501'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER lg_project_purpose_immutable BEFORE UPDATE ON public.lg_projects FOR EACH ROW EXECUTE FUNCTION launchgate_private.project_purpose_immutable();
CREATE FUNCTION launchgate_private.lab_source_boundary() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.lg_projects WHERE id=NEW.project_id AND purpose='REFERENCE_LAB') THEN RAISE EXCEPTION 'reference lab cannot bind customer source' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
CREATE TRIGGER lg_lab_source_boundary BEFORE INSERT OR UPDATE ON public.lg_repository_connections FOR EACH ROW EXECUTE FUNCTION launchgate_private.lab_source_boundary();
CREATE TABLE public.lg_product_labs (
 project_id uuid PRIMARY KEY REFERENCES public.lg_projects(id),organization_id uuid NOT NULL REFERENCES public.lg_organizations(id),
 invariant_id uuid NOT NULL DEFAULT gen_random_uuid(),adjacent_id uuid NOT NULL DEFAULT gen_random_uuid(),policy_id uuid NOT NULL DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'AWAITING_CONFIRMATION' CHECK(state IN ('AWAITING_CONFIRMATION','CONFIRMED','RUN_REQUESTED','RUNNING','COMPLETED','FAILED')),
 release_id uuid REFERENCES public.lg_release_candidates(id),lease_id uuid,lease_expires_at timestamptz,
 UNIQUE(organization_id,project_id)
);
ALTER TABLE public.lg_product_labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lg_product_labs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.lg_product_labs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(project_id,organization_id,invariant_id,adjacent_id,policy_id,created_by,created_at,state,release_id) ON public.lg_product_labs TO authenticated;
CREATE POLICY lg_product_labs_read ON public.lg_product_labs FOR SELECT TO authenticated USING(launchgate_private.has_role(organization_id,ARRAY['OWNER','ADMIN','DEVELOPER','VIEWER']));
CREATE FUNCTION public.lg_product_lab_command(p_organization uuid,p_project uuid,p_action text,p_policy jsonb,p_correlation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.lg_organization_memberships;p public.lg_projects;l public.lg_product_labs;
BEGIN
 actor:=launchgate_private.require_actor(p_organization,ARRAY['OWNER','ADMIN']);
 IF p_action='CREATE' THEN
  INSERT INTO public.lg_projects(organization_id,name,created_by,purpose) VALUES(p_organization,'Reference Lab · Tenant isolation',auth.uid(),'REFERENCE_LAB') RETURNING * INTO p;
  INSERT INTO public.lg_product_labs(project_id,organization_id,created_by) VALUES(p.id,p_organization,auth.uid()) RETURNING * INTO l;
 ELSE
  SELECT * INTO l FROM public.lg_product_labs WHERE project_id=p_project AND organization_id=p_organization FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lab access' USING ERRCODE='42501';END IF;
  IF p_action='CONFIRM' AND l.state='AWAITING_CONFIRMATION' THEN
   IF p_policy#>>'{policy,id}' IS DISTINCT FROM l.policy_id::text THEN RAISE EXCEPTION 'policy scope' USING ERRCODE='42501';END IF;
   PERFORM public.lg_release_command(p_project,'POLICY',p_policy,p_correlation);
   UPDATE public.lg_product_labs SET state='CONFIRMED' WHERE project_id=p_project RETURNING * INTO l;
  ELSIF p_action='RUN' AND l.state IN ('CONFIRMED','FAILED') THEN
   UPDATE public.lg_product_labs SET state='RUN_REQUESTED' WHERE project_id=p_project RETURNING * INTO l;
  ELSIF NOT ((p_action='CONFIRM' AND l.state<>'AWAITING_CONFIRMATION') OR (p_action='RUN' AND l.state IN ('RUN_REQUESTED','RUNNING','COMPLETED'))) THEN
   RAISE EXCEPTION 'lab state' USING ERRCODE='22023';
  END IF;
 END IF;
 PERFORM launchgate_private.append_audit(p_organization,actor,'EXECUTION_COMMAND','PROJECT',l.project_id,p_correlation);
 RETURN to_jsonb(l)-'lease_id'-'lease_expires_at';
END $$;
CREATE FUNCTION public.lg_product_lab_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.lg_product_labs;
BEGIN
 IF p_action='CATALOG' THEN RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('invariant_id',invariant_id,'adjacent_id',adjacent_id,'policy_id',policy_id)) FROM public.lg_product_labs),'[]'::jsonb);END IF;
 IF p_action='CLAIM' THEN
  SELECT * INTO l FROM public.lg_product_labs WHERE state='RUN_REQUESTED' OR (state='RUNNING' AND lease_expires_at<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL;END IF;
  UPDATE public.lg_product_labs SET state='RUNNING',lease_id=gen_random_uuid(),lease_expires_at=now()+interval '10 minutes' WHERE project_id=l.project_id RETURNING * INTO l;
  RETURN to_jsonb(l);
 ELSIF p_action IN ('COMPLETE','FAIL') THEN
  SELECT * INTO l FROM public.lg_product_labs WHERE project_id=(p_data->>'projectId')::uuid AND lease_id=(p_data->>'leaseId')::uuid AND lease_expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lab lease' USING ERRCODE='42501';END IF;
  IF p_action='COMPLETE' AND NOT EXISTS(SELECT 1 FROM public.lg_gate_evaluations WHERE project_id=l.project_id AND release_id=(p_data->>'releaseId')::uuid) THEN RAISE EXCEPTION 'lab evidence' USING ERRCODE='42501';END IF;
  UPDATE public.lg_product_labs SET state=CASE WHEN p_action='COMPLETE' THEN 'COMPLETED' ELSE 'FAILED' END,release_id=coalesce((p_data->>'releaseId')::uuid,release_id),lease_id=NULL,lease_expires_at=NULL WHERE project_id=l.project_id;
  RETURN '{}'::jsonb;
 END IF;
 RAISE EXCEPTION 'lab service action' USING ERRCODE='22023';
END $$;
REVOKE ALL ON FUNCTION launchgate_private.project_purpose_immutable(),launchgate_private.lab_source_boundary(),public.lg_product_lab_command(uuid,uuid,text,jsonb,uuid),public.lg_product_lab_service(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_product_lab_command(uuid,uuid,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lg_product_lab_service(text,jsonb) TO service_role;
COMMIT;
