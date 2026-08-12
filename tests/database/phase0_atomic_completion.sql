-- PBS CENTRAL Phase 0 completion/idempotency test.
-- Run only against the authorized PBS CENTRAL database. Every fixture is rolled back.
begin;

create temp table phase0_results(
  call_no int,
  handover_id uuid,
  handover_sequence int,
  replayed bool,
  session_status text
) on commit drop;
grant all on phase0_results to authenticated;

select set_config('pbs.test.user_a',(select id::text from auth.users order by id limit 1),true);
insert into public.kos_workspaces(id,slug,name) values
 ('30000000-0000-4000-8000-000000000003','phase0-atomic','Phase 0 Atomic');
insert into public.kos_workspace_members(workspace_id,user_id,role,is_active) values
 ('30000000-0000-4000-8000-000000000003',current_setting('pbs.test.user_a')::uuid,'owner',true);
insert into public.kos_agent_sessions(id,workspace_id,resume_key,objective,status,current_phase)
values ('30000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003','phase0-atomic-test','Verify atomic completion','active','test');
insert into public.kos_session_steps(workspace_id,session_id,sequence,title,instructions,status,attempts,max_attempts,depends_on,completion_criteria,completion_evidence)
values ('30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004',1,'Atomic test','Complete exactly once','running',1,3,'{}','{}','{}');

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pbs.test.user_a'),true);
insert into phase0_results select 1,* from public.kos_complete_session_step(
 '30000000-0000-4000-8000-000000000004',1,'phase0-live-atomic-key','{"verified":true}',
 '{"summary":"Atomic live test","completed":["step"],"tests":["live"],"git_state":{}}',true);
insert into phase0_results select 2,* from public.kos_complete_session_step(
 '30000000-0000-4000-8000-000000000004',1,'phase0-live-atomic-key','{"verified":true}',
 '{"summary":"Atomic live test","completed":["step"],"tests":["live"],"git_state":{}}',true);
reset role;

do $$
begin
  if (select handover_id from phase0_results where call_no=1)
     <> (select handover_id from phase0_results where call_no=2) then
    raise exception 'Idempotency failure: replay created a different handover';
  end if;
  if (select replayed from phase0_results where call_no=1)
     or not (select replayed from phase0_results where call_no=2) then
    raise exception 'Idempotency failure: replay flags are incorrect';
  end if;
  if (select count(*) from public.kos_agent_handovers where session_id='30000000-0000-4000-8000-000000000004') <> 1 then
    raise exception 'Atomicity failure: expected exactly one handover';
  end if;
  if (select status from public.kos_agent_sessions where id='30000000-0000-4000-8000-000000000004') <> 'completed'
     or (select status from public.kos_session_steps where session_id='30000000-0000-4000-8000-000000000004' and sequence=1) <> 'succeeded' then
    raise exception 'Atomicity failure: completion state was not committed together';
  end if;
end $$;

rollback;
