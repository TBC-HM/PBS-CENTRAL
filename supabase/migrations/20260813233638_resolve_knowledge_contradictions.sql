create or replace function public.kos_resolve_knowledge_relation(
  target_workspace uuid, target_relation uuid, resolution_action text, resolution_reason text
) returns public.kos_knowledge_relations
language plpgsql security invoker set search_path='' as $$
declare relation_row public.kos_knowledge_relations;
begin
  if not public.kos_has_role(target_workspace,array['owner','admin']::public.kos_workspace_role[]) then raise exception 'owner or admin required' using errcode='42501'; end if;
  if resolution_action not in ('source_preferred','target_preferred','contextual','dismissed') then raise exception 'invalid resolution action' using errcode='22023'; end if;
  if coalesce(trim(resolution_reason),'')='' then raise exception 'resolution reason required' using errcode='22023'; end if;
  select * into relation_row from public.kos_knowledge_relations where id=target_relation and workspace_id=target_workspace for update;
  if relation_row.id is null then raise exception 'relation not found in workspace' using errcode='P0002'; end if;
  if relation_row.relation_type <> 'contradicts' or relation_row.status <> 'open' then raise exception 'only open contradictions can be resolved' using errcode='22023'; end if;
  update public.kos_knowledge_relations set status='resolved',resolution=jsonb_build_object('action',resolution_action,'reason',resolution_reason)::text,resolved_by=(select auth.uid()),resolved_at=now() where id=relation_row.id returning * into relation_row;
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details) values(target_workspace,(select auth.uid()),'knowledge_contradiction_resolved','knowledge_relation',relation_row.id,jsonb_build_object('source',relation_row.source_knowledge_id,'target',relation_row.target_knowledge_id,'resolution_action',resolution_action,'reason',resolution_reason));
  return relation_row;
end $$;
revoke all on function public.kos_resolve_knowledge_relation(uuid,uuid,text,text) from public,anon;
grant execute on function public.kos_resolve_knowledge_relation(uuid,uuid,text,text) to authenticated;
