revoke all on table public.kos_knowledge_relations from anon,authenticated;
grant select on table public.kos_knowledge_relations to authenticated;
revoke all on function public.kos_search_knowledge(uuid,text,integer) from public,anon;
revoke all on function public.kos_record_knowledge_relation(uuid,uuid,uuid,text,text) from public,anon;
revoke all on function public.kos_supersede_knowledge(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.kos_search_knowledge(uuid,text,integer) to authenticated;
grant execute on function public.kos_record_knowledge_relation(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.kos_supersede_knowledge(uuid,uuid,text,text,text) to authenticated;
