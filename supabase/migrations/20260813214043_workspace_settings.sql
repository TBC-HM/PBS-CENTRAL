create table public.kos_workspace_settings (
 workspace_id uuid not null references public.kos_workspaces(id) on delete cascade, setting_key text not null, value jsonb not null,
 description text, updated_by uuid references auth.users(id), updated_at timestamptz not null default now(), primary key(workspace_id,setting_key)
);
alter table public.kos_workspace_settings enable row level security;
create policy kos_workspace_settings_read on public.kos_workspace_settings for select to authenticated using(public.kos_is_member(workspace_id));
create policy kos_workspace_settings_insert on public.kos_workspace_settings for insert to authenticated with check(public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]) and updated_by=(select auth.uid()));
create policy kos_workspace_settings_update on public.kos_workspace_settings for update to authenticated using(public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[])) with check(public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]) and updated_by=(select auth.uid()));
create policy kos_workspace_settings_delete on public.kos_workspace_settings for delete to authenticated using(public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));
grant select,insert,update,delete on public.kos_workspace_settings to authenticated;
insert into public.kos_workspace_settings(workspace_id,setting_key,value,description)
select id,x.key,x.value,x.description from public.kos_workspaces cross join (values
('document_categories','["General","Legal","Tax","Accounting","Banking","Registry","Contract","Correspondence","Asset","Personal"]'::jsonb,'Categories offered during document upload and filing'),
('company_types','["holding","opco","nonprofit","partnership","sole_trader","other"]'::jsonb,'Company classification choices'),
('contact_types','["external","employee","consultant","owner","director","legal","tax_advisor"]'::jsonb,'Relationship and contact types'),
('project_types','["application","initiative","portfolio"]'::jsonb,'Project type choices'),
('asset_types','["real_estate","boat","vehicle","art","collection","financial","digital","other"]'::jsonb,'Asset type choices'),
('priorities','["low","normal","high","urgent"]'::jsonb,'Work priority choices'),
('languages','["en","de","es","fr","it","pl"]'::jsonb,'Document helper languages')
) x(key,value,description) where slug='pbs-central' on conflict(workspace_id,setting_key) do nothing;
