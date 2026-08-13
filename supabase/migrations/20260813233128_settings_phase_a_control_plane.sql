create or replace function public.kos_update_workspace_profile(target_workspace uuid,profile_value jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare before_value jsonb;after_value jsonb;
begin
 if not public.kos_has_role(target_workspace,array['owner','admin']::public.kos_workspace_role[]) then raise exception 'owner or admin required' using errcode='42501'; end if;
 if coalesce(trim(profile_value->>'name'),'')='' then raise exception 'workspace name required' using errcode='22023'; end if;
 select jsonb_build_object('name',name,'operating_config',operating_config) into before_value from public.kos_workspaces where id=target_workspace for update;
 update public.kos_workspaces set name=profile_value->>'name',operating_config=coalesce(operating_config,'{}'::jsonb)||jsonb_strip_nulls(profile_value-'name') where id=target_workspace
 returning jsonb_build_object('name',name,'operating_config',operating_config) into after_value;
 insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details) values(target_workspace,(select auth.uid()),'workspace_profile_updated','workspace',target_workspace,jsonb_build_object('before',before_value,'after',after_value));
 return after_value;
end $$;

create or replace function public.kos_update_workspace_setting(target_workspace uuid,target_key text,value_value jsonb,reason_value text)
returns public.kos_workspace_settings language plpgsql security invoker set search_path='' as $$
declare before_value jsonb;changed public.kos_workspace_settings;
begin
 if not public.kos_has_role(target_workspace,array['owner','admin']::public.kos_workspace_role[]) then raise exception 'owner or admin required' using errcode='42501'; end if;
 if coalesce(trim(reason_value),'')='' then raise exception 'change reason required' using errcode='22023'; end if;
 select value into before_value from public.kos_workspace_settings where workspace_id=target_workspace and setting_key=target_key for update;
 update public.kos_workspace_settings set value=value_value,updated_by=(select auth.uid()),updated_at=now() where workspace_id=target_workspace and setting_key=target_key returning * into changed;
 if changed.setting_key is null then raise exception 'setting not found' using errcode='P0002'; end if;
 insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details) values(target_workspace,(select auth.uid()),'workspace_setting_updated','workspace_setting',target_workspace,jsonb_build_object('setting_key',target_key,'before',before_value,'after',value_value,'reason',reason_value));
 return changed;
end $$;

revoke all on function public.kos_update_workspace_profile(uuid,jsonb) from public,anon;
revoke all on function public.kos_update_workspace_setting(uuid,text,jsonb,text) from public,anon;
grant execute on function public.kos_update_workspace_profile(uuid,jsonb) to authenticated;
grant execute on function public.kos_update_workspace_setting(uuid,text,jsonb,text) to authenticated;
