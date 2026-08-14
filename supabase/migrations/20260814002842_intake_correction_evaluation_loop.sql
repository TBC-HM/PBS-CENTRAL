create table public.kos_extraction_evaluations (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
 extractor text not null,extractor_version text not null,field_path text not null,risk_class text not null,
 sample_size integer not null check(sample_size>=0),approved_count integer not null,corrected_count integer not null,rejected_count integer not null,
 correction_rate numeric,decision text not null check(decision in('insufficient_evidence','keep','adjust_deterministic_rule','candidate_model_change')),
 rationale text not null,requires_owner_approval boolean not null default true,approved_by uuid references auth.users(id),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(workspace_id,extractor,extractor_version,field_path,risk_class,created_at)
);
alter table public.kos_extraction_evaluations enable row level security;
create policy kos_extraction_evaluations_read on public.kos_extraction_evaluations for select to authenticated using(public.kos_is_member(workspace_id));
revoke all on public.kos_extraction_evaluations from public,anon,authenticated;grant select on public.kos_extraction_evaluations to authenticated;
create or replace function public.kos_evaluate_extraction_corrections(target_workspace uuid,extractor_value text,extractor_version_value text,field_value text,risk_value text)
returns public.kos_extraction_evaluations language plpgsql security definer set search_path='' as $$
declare total integer;approved integer;corrected integer;rejected integer;rate numeric;decision_value text;rationale_value text;evaluation public.kos_extraction_evaluations;
begin
 if not public.kos_has_role(target_workspace,array['owner','admin']::public.kos_workspace_role[]) then raise exception 'owner or admin required' using errcode='42501';end if;
 select count(*),count(*)filter(where status='approved'),count(*)filter(where status='corrected'),count(*)filter(where status='rejected') into total,approved,corrected,rejected from public.kos_extraction_reviews where workspace_id=target_workspace and extractor=extractor_value and extractor_version=extractor_version_value and field_path=field_value and risk_class=risk_value and status<>'pending';
 rate:=case when total=0 then null else corrected::numeric/total end;
 decision_value:=case when total<20 then 'insufficient_evidence' when rate>=.15 then 'adjust_deterministic_rule' else 'keep' end;
 rationale_value:=case when total<20 then 'At least 20 reviewed examples are required before changing a rule or model.' when rate>=.15 then 'Correction rate exceeds 15%; inspect and propose a deterministic rule adjustment first.' else 'Observed correction rate is below the change threshold.' end;
 insert into public.kos_extraction_evaluations(workspace_id,extractor,extractor_version,field_path,risk_class,sample_size,approved_count,corrected_count,rejected_count,correction_rate,decision,rationale,created_by) values(target_workspace,extractor_value,extractor_version_value,field_value,risk_value,total,approved,corrected,rejected,rate,decision_value,rationale_value,(select auth.uid())) returning * into evaluation;
 insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details) values(target_workspace,(select auth.uid()),'extraction_corrections_evaluated','extraction_evaluation',evaluation.id,jsonb_build_object('decision',decision_value,'sample_size',total,'correction_rate',rate));return evaluation;
end $$;
revoke all on function public.kos_evaluate_extraction_corrections(uuid,text,text,text,text) from public,anon;grant execute on function public.kos_evaluate_extraction_corrections(uuid,text,text,text,text) to authenticated;
