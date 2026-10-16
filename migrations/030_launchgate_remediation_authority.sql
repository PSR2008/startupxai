BEGIN;
CREATE FUNCTION launchgate_private.fix_immutable_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF (to_jsonb(NEW)-ARRAY['state','next_action','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','next_action','updated_at']) THEN RAISE EXCEPTION 'immutable proposal identity';END IF;RETURN NEW;
END $$;
CREATE TRIGGER lg_fix_identity BEFORE UPDATE ON public.lg_fix_proposals FOR EACH ROW EXECUTE FUNCTION launchgate_private.fix_immutable_identity();
CREATE FUNCTION launchgate_private.fix_immutable_verification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF OLD.state<>'VERIFYING' OR (to_jsonb(NEW)-ARRAY['state','evidence','manifest_digest']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','evidence','manifest_digest']) THEN RAISE EXCEPTION 'immutable fix verification';END IF;RETURN NEW;
END $$;
CREATE TRIGGER lg_fix_verification_immutable BEFORE UPDATE ON public.lg_fix_verification_runs FOR EACH ROW EXECUTE FUNCTION launchgate_private.fix_immutable_verification();
ALTER FUNCTION public.lg_fix_service(text,jsonb) RENAME TO lg_fix_service_v9;
CREATE FUNCTION public.lg_fix_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.lg_repository_connections;r public.lg_installation_repositories;i public.lg_github_installations;member public.lg_organization_memberships;cap public.lg_remediation_capabilities;
BEGIN
 IF p_action NOT IN ('CAPABILITY_CONTEXT','CAPABILITY_VERIFIED') THEN RETURN public.lg_fix_service_v9(p_action,p_data);END IF;
 SELECT * INTO c FROM public.lg_repository_connections WHERE id=(p_data->>'connectionId')::uuid AND project_id=(p_data->>'projectId')::uuid AND status='ACTIVE';
 IF c.id IS NULL THEN RAISE EXCEPTION 'connection access' USING ERRCODE='42501';END IF;
 member:=launchgate_private.source_actor(c.organization_id,(p_data->>'actorId')::uuid,ARRAY['OWNER','ADMIN']);
 SELECT * INTO r FROM public.lg_installation_repositories WHERE id=c.repository_id;SELECT * INTO i FROM public.lg_github_installations WHERE id=r.installation_id AND status='ACTIVE';
 IF i.id IS NULL THEN RAISE EXCEPTION 'installation access' USING ERRCODE='42501';END IF;
 IF p_action='CAPABILITY_CONTEXT' THEN RETURN jsonb_build_object('repositoryId',r.repository_id,'analysisAppId',i.app_id);END IF;
 IF (p_data->>'repositoryId')::bigint IS DISTINCT FROM r.repository_id OR (p_data->>'appId')::bigint=i.app_id OR coalesce((p_data->>'appId')::bigint,0)<=0 OR coalesce((p_data->>'installationId')::bigint,0)<=0 THEN RAISE EXCEPTION 'write capability scope' USING ERRCODE='42501';END IF;
 INSERT INTO public.lg_remediation_capabilities(organization_id,project_id,connection_id,app_id,installation_id,repository_id,enabled,verified_at,expires_at)
 VALUES(c.organization_id,c.project_id,c.id,(p_data->>'appId')::bigint,(p_data->>'installationId')::bigint,r.repository_id,true,clock_timestamp(),clock_timestamp()+interval '1 hour') RETURNING * INTO cap;
 PERFORM launchgate_private.append_audit(c.organization_id,member,'EXECUTION_COMMAND','PROJECT',c.project_id,gen_random_uuid());RETURN to_jsonb(cap);
END $$;
CREATE FUNCTION public.lg_fix_capability_revoke(p_project uuid,p_id uuid,p_correlation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;member public.lg_organization_memberships;BEGIN
 SELECT organization_id INTO org FROM public.lg_projects WHERE id=p_project;
 member:=launchgate_private.require_actor(org,ARRAY['OWNER','ADMIN']);
 UPDATE public.lg_remediation_capabilities SET enabled=false,revoked_at=clock_timestamp() WHERE id=p_id AND project_id=p_project AND organization_id=org;
 IF NOT FOUND THEN RAISE EXCEPTION 'capability access' USING ERRCODE='42501';END IF;
 PERFORM launchgate_private.append_audit(org,member,'EXECUTION_COMMAND','PROJECT',p_project,p_correlation);
END $$;
REVOKE ALL ON FUNCTION launchgate_private.fix_immutable_identity(),launchgate_private.fix_immutable_verification(),public.lg_fix_service_v9(text,jsonb),public.lg_fix_service(text,jsonb),public.lg_fix_capability_revoke(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lg_fix_service(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lg_fix_capability_revoke(uuid,uuid,uuid) TO authenticated;
COMMIT;
