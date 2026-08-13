create table if not exists public.kos_contact_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
  contact_id uuid not null references public.kos_contacts(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 10000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.kos_follow_ups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
  contact_id uuid not null references public.kos_contacts(id) on delete cascade,
  company_id uuid references public.kos_companies(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 500),
  due_date date,
  priority smallint not null default 2 check (priority between 1 and 3),
  status text not null default 'open' check (status in ('open','in_progress','waiting','done','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kos_contact_notes_contact_recent on public.kos_contact_notes(workspace_id,contact_id,created_at desc);
create index if not exists kos_follow_ups_contact_status on public.kos_follow_ups(workspace_id,contact_id,status,due_date);
alter table public.kos_contact_notes enable row level security;
alter table public.kos_follow_ups enable row level security;

create policy kos_contact_notes_read on public.kos_contact_notes for select to authenticated using (public.kos_is_member(workspace_id));
create policy kos_contact_notes_insert on public.kos_contact_notes for insert to authenticated with check (public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]) and created_by=(select auth.uid()));
create policy kos_contact_notes_update on public.kos_contact_notes for update to authenticated using (created_by=(select auth.uid()) or public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[])) with check (public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]));
create policy kos_contact_notes_delete on public.kos_contact_notes for delete to authenticated using (created_by=(select auth.uid()) or public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));
create policy kos_follow_ups_read on public.kos_follow_ups for select to authenticated using (public.kos_is_member(workspace_id));
create policy kos_follow_ups_insert on public.kos_follow_ups for insert to authenticated with check (public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]) and created_by=(select auth.uid()));
create policy kos_follow_ups_update on public.kos_follow_ups for update to authenticated using (public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[])) with check (public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]));
create policy kos_follow_ups_delete on public.kos_follow_ups for delete to authenticated using (public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));

create or replace function public.kos_update_contact(
  target_workspace uuid, target_contact uuid, contact_name text, contact_email text,
  contact_phone text, contact_role text, target_company uuid, contact_type_value text
) returns public.kos_contacts language plpgsql security definer set search_path=public as $$
declare actor uuid := auth.uid(); updated public.kos_contacts; company_name_value text;
begin
  if actor is null or not public.kos_has_role(target_workspace,array['owner','admin','member']::public.kos_workspace_role[]) then raise exception 'workspace write access required'; end if;
  if target_company is not null then select name into company_name_value from public.kos_companies where id=target_company and workspace_id=target_workspace; if not found then raise exception 'company not found in workspace'; end if; end if;
  update public.kos_contacts set name=coalesce(nullif(btrim(contact_name),''),name), email=nullif(btrim(contact_email),''), phone=nullif(btrim(contact_phone),''), role_title=nullif(btrim(contact_role),''), company_id=target_company, company_name=company_name_value, contact_type=coalesce(nullif(btrim(contact_type_value),''),contact_type), updated_at=now() where id=target_contact and workspace_id=target_workspace returning * into updated;
  if updated.id is null then raise exception 'contact not found in workspace'; end if;
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details) values(target_workspace,actor,'contact.updated','contact',target_contact,jsonb_build_object('company_id',target_company,'fields',jsonb_build_array('name','email','phone','role_title','company_id','contact_type')));
  return updated;
end; $$;

create or replace function public.kos_add_contact_note(target_workspace uuid,target_contact uuid,note_body text) returns public.kos_contact_notes language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); created public.kos_contact_notes;
begin
  if actor is null or not public.kos_has_role(target_workspace,array['owner','admin','member']::public.kos_workspace_role[]) then raise exception 'workspace write access required'; end if;
  if not exists(select 1 from public.kos_contacts where id=target_contact and workspace_id=target_workspace) then raise exception 'contact not found in workspace'; end if;
  insert into public.kos_contact_notes(workspace_id,contact_id,body,created_by) values(target_workspace,target_contact,note_body,actor) returning * into created;
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details) values(target_workspace,actor,'contact.note_added','contact',target_contact,jsonb_build_object('note_id',created.id));
  return created;
end; $$;

create or replace function public.kos_create_follow_up(target_workspace uuid,target_contact uuid,follow_up_title text,follow_up_due date,follow_up_priority smallint) returns public.kos_follow_ups language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); created public.kos_follow_ups; linked_company uuid;
begin
  if actor is null or not public.kos_has_role(target_workspace,array['owner','admin','member']::public.kos_workspace_role[]) then raise exception 'workspace write access required'; end if;
  select company_id into linked_company from public.kos_contacts where id=target_contact and workspace_id=target_workspace; if not found then raise exception 'contact not found in workspace'; end if;
  insert into public.kos_follow_ups(workspace_id,contact_id,company_id,title,due_date,priority,created_by) values(target_workspace,target_contact,linked_company,follow_up_title,follow_up_due,follow_up_priority,actor) returning * into created;
  insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details) values(target_workspace,actor,'follow_up.created','follow_up',created.id,jsonb_build_object('contact_id',target_contact,'due_date',follow_up_due,'priority',follow_up_priority));
  return created;
end; $$;

revoke execute on function public.kos_update_contact(uuid,uuid,text,text,text,text,uuid,text) from public,anon;
revoke execute on function public.kos_add_contact_note(uuid,uuid,text) from public,anon;
revoke execute on function public.kos_create_follow_up(uuid,uuid,text,date,smallint) from public,anon;
grant execute on function public.kos_update_contact(uuid,uuid,text,text,text,text,uuid,text) to authenticated;
grant execute on function public.kos_add_contact_note(uuid,uuid,text) to authenticated;
grant execute on function public.kos_create_follow_up(uuid,uuid,text,date,smallint) to authenticated;
grant select,insert,update,delete on public.kos_contact_notes,public.kos_follow_ups to authenticated;
