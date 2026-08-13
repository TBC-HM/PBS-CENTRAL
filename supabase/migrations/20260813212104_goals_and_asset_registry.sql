create table public.kos_assets (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
 company_id uuid references public.kos_companies(id) on delete set null, parent_asset_id uuid references public.kos_assets(id) on delete set null,
 asset_type text not null, name text not null, status text not null default 'active', visibility text not null default 'workspace',
 jurisdiction text, location text, acquisition_date date, acquisition_value numeric, currency text, identifiers jsonb not null default '{}'::jsonb,
 details jsonb not null default '{}'::jsonb, created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(asset_type in('real_estate','boat','vehicle','art','collection','financial','digital','other')), check(visibility in('workspace','private')), check(status in('planned','active','held_for_sale','sold','archived'))
);
create unique index if not exists kos_companies_workspace_identity on public.kos_companies(workspace_id,id);
create unique index kos_assets_workspace_identity on public.kos_assets(workspace_id,id);
alter table public.kos_assets add constraint kos_assets_company_workspace_fk foreign key(workspace_id,company_id) references public.kos_companies(workspace_id,id);
create table public.kos_intentions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
 company_id uuid references public.kos_companies(id) on delete cascade, asset_id uuid references public.kos_assets(id) on delete cascade,
 title text not null, purpose text not null, desired_outcome text not null, success_measures text not null, constraints text, exclusions text,
 horizon text, priorities text, risks text, questions_remaining text, markdown text not null, version integer not null default 1,
 status text not null default 'draft', created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(num_nonnulls(company_id,asset_id)=1), check(status in('draft','active','achieved','archived'))
);
alter table public.kos_intentions add constraint kos_intentions_company_workspace_fk foreign key(workspace_id,company_id) references public.kos_companies(workspace_id,id);
alter table public.kos_intentions add constraint kos_intentions_asset_workspace_fk foreign key(workspace_id,asset_id) references public.kos_assets(workspace_id,id);
create unique index kos_intentions_one_active_subject on public.kos_intentions(workspace_id,coalesce(company_id,asset_id)) where status in('draft','active');
create index kos_assets_workspace_company on public.kos_assets(workspace_id,company_id,asset_type);
alter table public.kos_assets enable row level security; alter table public.kos_intentions enable row level security;
create policy kos_assets_read on public.kos_assets for select to authenticated using(public.kos_is_member(workspace_id) and (visibility='workspace' or created_by=(select auth.uid()) or public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[])));
create policy kos_assets_write on public.kos_assets for insert to authenticated with check(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]) and created_by=(select auth.uid()));
create policy kos_assets_update on public.kos_assets for update to authenticated using(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]) and (visibility='workspace' or created_by=(select auth.uid()) or public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]))) with check(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]));
create policy kos_assets_delete on public.kos_assets for delete to authenticated using(created_by=(select auth.uid()) or public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));
create policy kos_intentions_read on public.kos_intentions for select to authenticated using(public.kos_is_member(workspace_id) and (asset_id is null or exists(select 1 from public.kos_assets a where a.id=asset_id and a.workspace_id=kos_intentions.workspace_id and (a.visibility='workspace' or a.created_by=(select auth.uid()) or public.kos_has_role(a.workspace_id,array['owner','admin']::public.kos_workspace_role[])))));
create policy kos_intentions_write on public.kos_intentions for insert to authenticated with check(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]) and created_by=(select auth.uid()) and (company_id is null or exists(select 1 from public.kos_companies c where c.id=company_id and c.workspace_id=kos_intentions.workspace_id)) and (asset_id is null or exists(select 1 from public.kos_assets a where a.id=asset_id and a.workspace_id=kos_intentions.workspace_id and (a.visibility='workspace' or a.created_by=(select auth.uid()) or public.kos_has_role(a.workspace_id,array['owner','admin']::public.kos_workspace_role[])))));
create policy kos_intentions_update on public.kos_intentions for update to authenticated using(created_by=(select auth.uid()) or public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[])) with check(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]));
create policy kos_intentions_delete on public.kos_intentions for delete to authenticated using(created_by=(select auth.uid()) or public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));
grant select,insert,update,delete on public.kos_assets,public.kos_intentions to authenticated;
