-- Permission-first knowledge retrieval. Restricted records require an explicit
-- resource grant unless the caller is a workspace owner/admin.
create or replace function public.kos_can_read_knowledge(target_workspace uuid,target_knowledge uuid,record_visibility public.kos_visibility,record_sensitivity public.kos_sensitivity)
returns boolean language sql stable security invoker set search_path='' as $$
  select public.kos_is_member(target_workspace) and (
    (record_visibility='workspace' and record_sensitivity <> 'restricted')
    or public.kos_has_role(target_workspace,array['owner','admin']::public.kos_workspace_role[])
    or exists(select 1 from public.kos_resource_grants g where g.workspace_id=target_workspace and g.user_id=(select auth.uid()) and g.resource_type='knowledge' and g.resource_id=target_knowledge and g.permission in ('read','write','manage'))
  )
$$;

drop policy if exists kos_knowledge_items_read on public.kos_knowledge_items;
create policy kos_knowledge_items_read on public.kos_knowledge_items for select to authenticated
using (public.kos_can_read_knowledge(workspace_id,id,visibility,sensitivity));

drop function if exists public.kos_search_knowledge(uuid,text,integer);
create function public.kos_search_knowledge(target_workspace uuid,query_text text,result_limit integer default 30)
returns table (
  id uuid,title text,body text,kind public.kos_knowledge_kind,verification_status text,
  confidence numeric,rank real,source_count bigint,open_contradictions bigint,
  sensitivity public.kos_sensitivity,visibility public.kos_visibility,updated_at timestamptz,
  citations jsonb
) language sql stable security invoker set search_path='' as $$
  select k.id,k.title,k.body,k.kind,k.verification_status,k.confidence,
    ((case when nullif(trim(query_text),'') is null then 0 else ts_rank_cd(k.search_document,websearch_to_tsquery('simple',query_text)) end)
      + case k.verification_status when 'verified' then .35 when 'approved' then .30 when 'candidate' then .10 else 0 end
      + least(extract(epoch from (now()-k.updated_at))/86400,365)::real / -3650)::real,
    (select count(*) from public.kos_knowledge_sources s where s.workspace_id=target_workspace and s.knowledge_id=k.id),
    (select count(*) from public.kos_knowledge_relations r where r.workspace_id=target_workspace and r.status='open' and r.relation_type='contradicts' and (r.source_knowledge_id=k.id or r.target_knowledge_id=k.id)),
    k.sensitivity,k.visibility,k.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object('source_type',s.source_type,'source_id',s.source_id,'locator',s.locator,'quote',s.quote) order by s.source_type,s.source_id) from public.kos_knowledge_sources s where s.workspace_id=target_workspace and s.knowledge_id=k.id),'[]'::jsonb)
  from public.kos_knowledge_items k
  where k.workspace_id=target_workspace and public.kos_can_read_knowledge(target_workspace,k.id,k.visibility,k.sensitivity)
    and k.verification_status not in ('superseded','rejected')
    and (nullif(trim(query_text),'') is null or k.search_document @@ websearch_to_tsquery('simple',query_text))
  order by 7 desc,k.updated_at desc limit least(greatest(result_limit,1),100)
$$;

revoke all on function public.kos_can_read_knowledge(uuid,uuid,public.kos_visibility,public.kos_sensitivity) from public,anon;
revoke all on function public.kos_search_knowledge(uuid,text,integer) from public,anon;
grant execute on function public.kos_can_read_knowledge(uuid,uuid,public.kos_visibility,public.kos_sensitivity) to authenticated;
grant execute on function public.kos_search_knowledge(uuid,text,integer) to authenticated;
