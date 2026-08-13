create table public.kos_projects (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
 company_id uuid references public.kos_companies(id) on delete set null, slug text not null, name text not null,
 description text, project_type text not null default 'application', status text not null default 'planning', health text not null default 'unknown',
 repository_url text, production_url text, preview_url text, owner_user_id uuid references auth.users(id), metadata jsonb not null default '{}'::jsonb,
 created_by uuid default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,slug), check(status in('planning','active','on_hold','done','archived','cancelled')), check(health in('green','amber','red','unknown'))
);
create table public.kos_integrations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
 company_id uuid references public.kos_companies(id) on delete set null, provider text not null, account_label text not null,
 account_identifier text, category text not null default 'business_app', status text not null default 'not_connected',
 scopes text[] not null default '{}', credential_reference text, last_sync_at timestamptz, last_error text, metadata jsonb not null default '{}'::jsonb,
 connected_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,provider,account_label), check(status in('not_connected','configuration_required','connected','degraded','revoked'))
);
create index kos_projects_company on public.kos_projects(workspace_id,company_id);
create index kos_integrations_company on public.kos_integrations(workspace_id,company_id,status);
alter table public.kos_projects enable row level security; alter table public.kos_integrations enable row level security;
create policy kos_projects_read on public.kos_projects for select to authenticated using(public.kos_is_member(workspace_id));
create policy kos_projects_insert on public.kos_projects for insert to authenticated with check(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]));
create policy kos_projects_update on public.kos_projects for update to authenticated using(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[])) with check(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]));
create policy kos_projects_delete on public.kos_projects for delete to authenticated using(public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));
create policy kos_integrations_read on public.kos_integrations for select to authenticated using(public.kos_is_member(workspace_id));
create policy kos_integrations_insert on public.kos_integrations for insert to authenticated with check(public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));
create policy kos_integrations_update on public.kos_integrations for update to authenticated using(public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[])) with check(public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));
create policy kos_integrations_delete on public.kos_integrations for delete to authenticated using(public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));
grant select,insert,update,delete on public.kos_projects,public.kos_integrations to authenticated;
insert into public.kos_projects(workspace_id,slug,name,description,project_type,status,health,metadata)
select w.id,v.slug,v.name,v.description,v.project_type,v.status,v.health,v.metadata from public.kos_workspaces w cross join (values
 ('pbs-central','PBS CENTRAL','Governed operating system and institutional memory platform.','application','active','green','{"source":"production"}'::jsonb),
 ('tbc-applications','TBC Applications','Application development portfolio imported from the legacy project register.','portfolio','active','green','{"legacy_code":"P-034","migrated_from":"projects"}'::jsonb),
 ('create-business-plan','Create Business Plan','Business planning initiative imported from the legacy project register.','initiative','planning','green','{"legacy_code":"P-001","migrated_from":"projects"}'::jsonb)
) v(slug,name,description,project_type,status,health,metadata) where w.slug='pbs-central' on conflict(workspace_id,slug) do update set name=excluded.name,description=excluded.description,updated_at=now();
insert into public.kos_integrations(workspace_id,provider,account_label,category,status,scopes,metadata)
select id,'google','Google Workspace','productivity','configuration_required',array['drive.readonly','gmail.readonly','calendar.readonly'],jsonb_build_object('oauth_start','/api/integrations/google/start','note','OAuth client credentials required in Vercel') from public.kos_workspaces where slug='pbs-central' on conflict(workspace_id,provider,account_label) do nothing;
