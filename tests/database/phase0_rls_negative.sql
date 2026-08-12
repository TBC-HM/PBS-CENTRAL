-- PBS CENTRAL Phase 0 tenant-isolation negative test.
-- Run only against the authorized PBS CENTRAL database. Every fixture is rolled back.
begin;

select set_config('pbs.test.user_a',(select id::text from auth.users order by id limit 1),true);
select set_config('pbs.test.user_b',(select id::text from auth.users order by id offset 1 limit 1),true);

do $$
begin
  if nullif(current_setting('pbs.test.user_a', true),'') is null
     or nullif(current_setting('pbs.test.user_b', true),'') is null then
    raise exception 'Two existing PBS CENTRAL auth identities are required';
  end if;
end $$;

insert into public.kos_workspaces(id,slug,name) values
 ('10000000-0000-4000-8000-000000000001','phase0-rls-a','Phase 0 RLS A'),
 ('20000000-0000-4000-8000-000000000002','phase0-rls-b','Phase 0 RLS B');
insert into public.kos_workspace_members(workspace_id,user_id,role,is_active) values
 ('10000000-0000-4000-8000-000000000001',current_setting('pbs.test.user_a')::uuid,'owner',true),
 ('20000000-0000-4000-8000-000000000002',current_setting('pbs.test.user_b')::uuid,'owner',true);

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pbs.test.user_a'),true);

do $$
begin
  if (select count(*) from public.kos_workspaces where id='10000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'RLS failure: own workspace is not visible';
  end if;
  if (select count(*) from public.kos_workspaces where id='20000000-0000-4000-8000-000000000002') <> 0 then
    raise exception 'RLS failure: foreign workspace is visible';
  end if;
  if (select count(*) from public.kos_workspace_members where workspace_id='20000000-0000-4000-8000-000000000002') <> 0 then
    raise exception 'RLS failure: foreign membership is visible';
  end if;
  if not public.kos_is_member('10000000-0000-4000-8000-000000000001')
     or public.kos_is_member('20000000-0000-4000-8000-000000000002') then
    raise exception 'RLS failure: membership helper crossed tenant boundary';
  end if;
end $$;

rollback;
