-- Sample the verification clock once so expiry obeys the strict one-hour bound.
BEGIN;
CREATE OR REPLACE FUNCTION public.lg_fix_service(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.lg_repository_connections;r public.lg_installation_repositories;i public.lg_github_installations;member public.lg_organization_memberships;cap public.lg_remediation_capabilities;verified_time timestamptz;
BEGIN
 IF p_action NOT IN ('CAPABILITY_CONTEXT','CAPABILITY_VERIFIED') THEN RETURN public.lg_fix_service_v9(p_action,p_data);END IF;
 SELECT * INTO c FROM public.lg_repository_connections WHERE id=(p_data->>'connectionId')::uuid AND project_id=(p_data->>'projectId')::uuid AND status='ACTIVE';
 IF c.id IS NULL THEN RAISE EXCEPTION 'connection access' USING ERRCODE='42501';END IF;
 member:=launchgate_private.source_actor(c.organization_id,(p_data->>'actorId')::uuid,ARRAY['OWNER','ADMIN']);
 SELECT * INTO r FROM public.lg_installation_repositories WHERE id=c.repository_id;SELECT * INTO i FROM public.lg_github_installations WHERE id=r.installation_id AND status='ACTIVE';
 IF i.id IS NULL THEN RAISE EXCEPTION 'installation access' USING ERRCODE='42501';END IF;
 IF p_action='CAPABILITY_CONTEXT' THEN RETURN jsonb_build_object('repositoryId',r.repository_id,'analysisAppId',i.app_id);END IF;
 IF (p_data->>'repositoryId')::bigint IS DISTINCT FROM r.repository_id OR (p_data->>'appId')::bigint=i.app_id OR coalesce((p_data->>'appId')::bigint,0)<=0 OR coalesce((p_data->>'installationId')::bigint,0)<=0 THEN RAISE EXCEPTION 'write capability scope' USING ERRCODE='42501';END IF;
 verified_time:=clock_timestamp();
 INSERT INTO public.lg_remediation_capabilities(organization_id,project_id,connection_id,app_id,installation_id,repository_id,enabled,verified_at,expires_at)
 VALUES(c.organization_id,c.project_id,c.id,(p_data->>'appId')::bigint,(p_data->>'installationId')::bigint,r.repository_id,true,verified_time,verified_time+interval '1 hour') RETURNING * INTO cap;
 PERFORM launchgate_private.append_audit(c.organization_id,member,'EXECUTION_COMMAND','PROJECT',c.project_id,gen_random_uuid());RETURN to_jsonb(cap);
END $$;
COMMIT;
