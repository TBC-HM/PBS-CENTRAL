-- Production Slice 01: governed evidence -> decision -> approval -> action -> outcome -> handover.

create unique index if not exists kos_audit_events_workspace_request
  on public.kos_audit_events(workspace_id, request_id)
  where request_id is not null;

drop policy if exists kos_approvals_update on public.kos_approvals;
create policy kos_approvals_update on public.kos_approvals
  for update to authenticated
  using (public.kos_has_role(workspace_id, array['owner','admin']::public.kos_workspace_role[]))
  with check (public.kos_has_role(workspace_id, array['owner','admin']::public.kos_workspace_role[]));

create or replace function public.kos_slice_record_decision(
  target_workspace uuid,
  evidence_id uuid,
  decision_title text,
  decision_body text,
  requested_action text
) returns table(decision_id uuid, approval_id uuid)
language plpgsql security invoker set search_path=''
as $$
declare
  new_decision public.kos_knowledge_items%rowtype;
  new_approval public.kos_approvals%rowtype;
begin
  if not public.kos_has_role(target_workspace,array['owner','admin','member']::public.kos_workspace_role[]) then
    raise exception using errcode='42501',message='member authority is required';
  end if;
  if nullif(pg_catalog.btrim(decision_title),'') is null or nullif(pg_catalog.btrim(decision_body),'') is null then
    raise exception using errcode='22023',message='decision title and body are required';
  end if;
  perform 1 from public.kos_knowledge_items k where k.id=evidence_id and k.workspace_id=target_workspace;
  if not found then raise exception using errcode='42501',message='evidence is unavailable in the current workspace'; end if;

  insert into public.kos_knowledge_items(workspace_id,kind,title,body,structured_data,verification_status,created_by)
  values(target_workspace,'decision',decision_title,decision_body,
    pg_catalog.jsonb_build_object('state','recorded','evidence_id',evidence_id,'requested_action',requested_action),
    'recorded',(select auth.uid())) returning * into new_decision;
  insert into public.kos_knowledge_sources(knowledge_id,workspace_id,source_type,source_id,locator)
  values(new_decision.id,target_workspace,'knowledge_item',evidence_id,pg_catalog.jsonb_build_object('relationship','decision_evidence'));
  insert into public.kos_approvals(workspace_id,subject_type,subject_id,action,requested_by)
  values(target_workspace,'knowledge_decision',new_decision.id,requested_action,(select auth.uid())) returning * into new_approval;
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details)
  values(target_workspace,(select auth.uid()),'slice_decision_recorded','knowledge_item',new_decision.id,
    pg_catalog.jsonb_build_object('evidence_id',evidence_id,'approval_id',new_approval.id));
  return query select new_decision.id,new_approval.id;
end $$;

create or replace function public.kos_slice_decide_approval(
  target_workspace uuid,
  target_approval uuid,
  approve boolean,
  rationale_value text
) returns public.kos_approvals
language plpgsql security definer set search_path=''
as $$
declare selected public.kos_approvals%rowtype;
begin
  if not public.kos_has_role(target_workspace,array['owner','admin']::public.kos_workspace_role[]) then
    raise exception using errcode='42501',message='owner or admin authority is required';
  end if;
  select * into selected from public.kos_approvals a where a.id=target_approval and a.workspace_id=target_workspace for update;
  if not found then raise exception using errcode='42501',message='approval is unavailable in the current workspace'; end if;
  if selected.status <> 'pending' then raise exception using errcode='55000',message='approval has already been decided'; end if;
  update public.kos_approvals set status=case when approve then 'approved' else 'rejected' end,
    decided_by=(select auth.uid()),rationale=rationale_value,decided_at=pg_catalog.now()
  where id=selected.id returning * into selected;
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details)
  values(target_workspace,(select auth.uid()),case when approve then 'slice_approval_approved' else 'slice_approval_rejected' end,
    'approval',selected.id,pg_catalog.jsonb_build_object('rationale',rationale_value,'subject_id',selected.subject_id));
  return selected;
end $$;

create or replace function public.kos_slice_execute_action(
  target_workspace uuid,
  target_approval uuid,
  idempotency_key_value text
) returns table(job_id uuid,replayed boolean)
language plpgsql security definer set search_path=''
as $$
declare selected public.kos_approvals%rowtype; existing_job uuid; new_job uuid;
begin
  if not public.kos_has_role(target_workspace,array['owner','admin','member']::public.kos_workspace_role[]) then
    raise exception using errcode='42501',message='member authority is required';
  end if;
  if nullif(pg_catalog.btrim(idempotency_key_value),'') is null then raise exception using errcode='22023',message='idempotency key is required'; end if;
  select (a.details->>'job_id')::uuid into existing_job from public.kos_audit_events a
    where a.workspace_id=target_workspace and a.request_id=idempotency_key_value and a.action='slice_action_executed';
  if existing_job is not null then return query select existing_job,true; return; end if;
  select * into selected from public.kos_approvals a where a.id=target_approval and a.workspace_id=target_workspace for update;
  if not found then raise exception using errcode='42501',message='approval is unavailable in the current workspace'; end if;
  if selected.status <> 'approved' then raise exception using errcode='55000',message='action requires an approved gate'; end if;
  insert into public.kos_processing_jobs(workspace_id,job_type,resource_type,resource_id,status,payload,result,started_at,completed_at)
  values(target_workspace,'slice_01_approved_action','knowledge_decision',selected.subject_id,'succeeded',
    pg_catalog.jsonb_build_object('approval_id',selected.id,'requested_action',selected.action),
    pg_catalog.jsonb_build_object('verification_status','awaiting_evidence'),pg_catalog.now(),pg_catalog.now()) returning id into new_job;
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details,request_id)
  values(target_workspace,(select auth.uid()),'slice_action_executed','processing_job',new_job,
    pg_catalog.jsonb_build_object('job_id',new_job,'approval_id',selected.id,'decision_id',selected.subject_id),idempotency_key_value);
  return query select new_job,false;
end $$;

create or replace function public.kos_slice_verify_outcome(
  target_workspace uuid,
  target_job uuid,
  evidence_id uuid,
  outcome_summary text
) returns public.kos_processing_jobs
language plpgsql security definer set search_path=''
as $$
declare selected public.kos_processing_jobs%rowtype;
begin
  if not public.kos_has_role(target_workspace,array['owner','admin','member']::public.kos_workspace_role[]) then
    raise exception using errcode='42501',message='member authority is required';
  end if;
  if nullif(pg_catalog.btrim(outcome_summary),'') is null then raise exception using errcode='22023',message='outcome summary is required'; end if;
  perform 1 from public.kos_knowledge_items k where k.id=evidence_id and k.workspace_id=target_workspace;
  if not found then raise exception using errcode='42501',message='verification evidence is unavailable in the current workspace'; end if;
  select * into selected from public.kos_processing_jobs j where j.id=target_job and j.workspace_id=target_workspace and j.job_type='slice_01_approved_action' for update;
  if not found then raise exception using errcode='42501',message='action is unavailable in the current workspace'; end if;
  update public.kos_processing_jobs set result=coalesce(result,'{}'::jsonb)||pg_catalog.jsonb_build_object(
    'verification_status','verified','evidence_id',evidence_id,'summary',outcome_summary,'verified_by',(select auth.uid()),'verified_at',pg_catalog.now())
  where id=selected.id returning * into selected;
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details)
  values(target_workspace,(select auth.uid()),'slice_outcome_verified','processing_job',selected.id,
    pg_catalog.jsonb_build_object('evidence_id',evidence_id,'summary',outcome_summary));
  return selected;
end $$;

revoke all on function public.kos_slice_record_decision(uuid,uuid,text,text,text) from public;
revoke all on function public.kos_slice_decide_approval(uuid,uuid,boolean,text) from public;
revoke all on function public.kos_slice_execute_action(uuid,uuid,text) from public;
revoke all on function public.kos_slice_verify_outcome(uuid,uuid,uuid,text) from public;
grant execute on function public.kos_slice_record_decision(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.kos_slice_decide_approval(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.kos_slice_execute_action(uuid,uuid,text) to authenticated;
grant execute on function public.kos_slice_verify_outcome(uuid,uuid,uuid,text) to authenticated;
