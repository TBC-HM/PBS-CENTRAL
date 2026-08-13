-- Second Brain v2: append-only contradiction/supersession governance and
-- permission-first workspace retrieval. Original evidence remains unchanged.

alter table public.kos_knowledge_items
  add constraint kos_knowledge_items_id_workspace_unique unique (id,workspace_id);

create table public.kos_knowledge_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
  source_knowledge_id uuid not null,
  target_knowledge_id uuid not null,
  relation_type text not null check (relation_type in ('contradicts','supersedes','supports')),
  status text not null default 'open' check (status in ('open','resolved','accepted')),
  reason text not null,
  resolution text,
  created_by uuid not null references auth.users(id),
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint kos_knowledge_relation_distinct check (source_knowledge_id <> target_knowledge_id),
  unique (workspace_id, source_knowledge_id, target_knowledge_id, relation_type),
  foreign key (source_knowledge_id,workspace_id) references public.kos_knowledge_items(id,workspace_id) on delete cascade,
  foreign key (target_knowledge_id,workspace_id) references public.kos_knowledge_items(id,workspace_id) on delete restrict
);

create index kos_knowledge_relations_workspace_status_idx
  on public.kos_knowledge_relations(workspace_id,status,relation_type);

alter table public.kos_knowledge_relations enable row level security;
create policy kos_knowledge_relations_read on public.kos_knowledge_relations
  for select to authenticated using (public.kos_is_member(workspace_id));
create policy kos_knowledge_relations_update on public.kos_knowledge_relations
  for update to authenticated using (
    public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[])
  ) with check (
    public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[])
  );

create or replace function public.kos_search_knowledge(
  target_workspace uuid,
  query_text text,
  result_limit integer default 30
) returns table (
  id uuid, title text, body text, kind public.kos_knowledge_kind,
  verification_status text, confidence numeric, rank real,
  source_count bigint, open_contradictions bigint
) language sql stable security invoker set search_path='' as $$
  select k.id,k.title,k.body,k.kind,k.verification_status,k.confidence,
    case when nullif(websearch_to_tsquery('simple',query_text)::text,'') is null then 0::real
      else ts_rank_cd(k.search_document,websearch_to_tsquery('simple',query_text)) end,
    (select count(*) from public.kos_knowledge_sources s where s.workspace_id=target_workspace and s.knowledge_id=k.id),
    (select count(*) from public.kos_knowledge_relations r where r.workspace_id=target_workspace and r.status='open' and r.relation_type='contradicts' and (r.source_knowledge_id=k.id or r.target_knowledge_id=k.id))
  from public.kos_knowledge_items k
  where k.workspace_id=target_workspace
    and public.kos_is_member(target_workspace)
    and k.verification_status not in ('superseded','rejected')
    and (nullif(trim(query_text),'') is null or k.search_document @@ websearch_to_tsquery('simple',query_text))
  order by 7 desc,k.updated_at desc
  limit least(greatest(result_limit,1),100)
$$;

create or replace function public.kos_record_knowledge_relation(
  target_workspace uuid,
  source_knowledge uuid,
  target_knowledge uuid,
  relation text,
  reason_value text
) returns public.kos_knowledge_relations
language plpgsql security invoker set search_path='' as $$
declare created public.kos_knowledge_relations;
begin
  if not public.kos_has_role(target_workspace,array['owner','admin','member']::public.kos_workspace_role[]) then raise exception 'insufficient role' using errcode='42501'; end if;
  if relation not in ('contradicts','supports') then raise exception 'relation requires governed resolution' using errcode='22023'; end if;
  if not exists(select 1 from public.kos_knowledge_items where id=source_knowledge and workspace_id=target_workspace)
     or not exists(select 1 from public.kos_knowledge_items where id=target_knowledge and workspace_id=target_workspace) then raise exception 'knowledge outside workspace' using errcode='42501'; end if;
  insert into public.kos_knowledge_relations(workspace_id,source_knowledge_id,target_knowledge_id,relation_type,reason,created_by)
  values(target_workspace,source_knowledge,target_knowledge,relation,reason_value,(select auth.uid())) returning * into created;
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details)
  values(target_workspace,(select auth.uid()),'knowledge_relation_recorded','knowledge',source_knowledge,jsonb_build_object('target',target_knowledge,'relation',relation));
  return created;
end $$;

create or replace function public.kos_supersede_knowledge(
  target_workspace uuid,
  prior_knowledge uuid,
  replacement_title text,
  replacement_body text,
  reason_value text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare prior public.kos_knowledge_items; replacement uuid;
begin
  if not public.kos_has_role(target_workspace,array['owner','admin']::public.kos_workspace_role[]) then raise exception 'owner or admin required' using errcode='42501'; end if;
  select * into prior from public.kos_knowledge_items where id=prior_knowledge and workspace_id=target_workspace for update;
  if prior.id is null then raise exception 'knowledge not found' using errcode='P0002'; end if;
  insert into public.kos_knowledge_items(workspace_id,kind,title,body,structured_data,confidence,verification_status,sensitivity,visibility,created_by)
  values(target_workspace,prior.kind,replacement_title,replacement_body,jsonb_build_object('supersedes',prior.id,'reason',reason_value),prior.confidence,'candidate',prior.sensitivity,prior.visibility,(select auth.uid())) returning id into replacement;
  update public.kos_knowledge_items set verification_status='superseded',updated_at=now() where id=prior.id;
  insert into public.kos_knowledge_relations(workspace_id,source_knowledge_id,target_knowledge_id,relation_type,status,reason,resolution,created_by,resolved_by,resolved_at)
  values(target_workspace,replacement,prior.id,'supersedes','accepted',reason_value,'Replacement created as candidate; prior item retained append-only.',(select auth.uid()),(select auth.uid()),now());
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details)
  values(target_workspace,(select auth.uid()),'knowledge_superseded','knowledge',prior.id,jsonb_build_object('replacement',replacement,'reason',reason_value));
  return replacement;
end $$;

grant select,update on public.kos_knowledge_relations to authenticated;
grant execute on function public.kos_search_knowledge(uuid,text,integer) to authenticated;
grant execute on function public.kos_record_knowledge_relation(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.kos_supersede_knowledge(uuid,uuid,text,text,text) to authenticated;
revoke all on function public.kos_search_knowledge(uuid,text,integer) from anon;
revoke all on function public.kos_record_knowledge_relation(uuid,uuid,uuid,text,text) from anon;
revoke all on function public.kos_supersede_knowledge(uuid,uuid,text,text,text) from anon;
