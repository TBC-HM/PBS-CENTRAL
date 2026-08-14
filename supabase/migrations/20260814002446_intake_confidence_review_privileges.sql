-- Keep the table non-writable from the API. These narrowly scoped functions
-- retain their internal role, tenant, decision, reason and audit checks.
alter function public.kos_record_extraction_review(uuid,uuid,uuid,uuid,text,jsonb,numeric,text,text,text) security definer;
alter function public.kos_resolve_extraction_review(uuid,uuid,text,jsonb,text) security definer;
revoke all on public.kos_extraction_reviews from public,anon,authenticated;
grant select on public.kos_extraction_reviews to authenticated;
revoke all on function public.kos_record_extraction_review(uuid,uuid,uuid,uuid,text,jsonb,numeric,text,text,text) from public,anon;
revoke all on function public.kos_resolve_extraction_review(uuid,uuid,text,jsonb,text) from public,anon;
grant execute on function public.kos_record_extraction_review(uuid,uuid,uuid,uuid,text,jsonb,numeric,text,text,text) to authenticated;
grant execute on function public.kos_resolve_extraction_review(uuid,uuid,text,jsonb,text) to authenticated;
