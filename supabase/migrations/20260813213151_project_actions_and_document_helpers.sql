create unique index if not exists kos_documents_workspace_identity on public.kos_documents(workspace_id,id);
create table public.kos_document_derivatives (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
 document_id uuid not null references public.kos_documents(id) on delete cascade, derivative_type text not null,
 target_language text, status text not null default 'requested', content text, model_provider text, model_name text,
 error_message text, requested_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), completed_at timestamptz,
 unique(document_id,derivative_type,target_language), foreign key(workspace_id,document_id) references public.kos_documents(workspace_id,id), check(derivative_type in('summary','translation')), check(status in('requested','processing','completed','failed'))
);
create index kos_document_derivatives_document on public.kos_document_derivatives(workspace_id,document_id);
alter table public.kos_document_derivatives enable row level security;
create policy kos_document_derivatives_read on public.kos_document_derivatives for select to authenticated using(public.kos_is_member(workspace_id) and exists(select 1 from public.kos_documents d where d.id=document_id and d.workspace_id=kos_document_derivatives.workspace_id));
create policy kos_document_derivatives_insert on public.kos_document_derivatives for insert to authenticated with check(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]) and requested_by=(select auth.uid()) and exists(select 1 from public.kos_documents d where d.id=document_id and d.workspace_id=kos_document_derivatives.workspace_id));
create policy kos_document_derivatives_update on public.kos_document_derivatives for update to authenticated using((requested_by=(select auth.uid()) or public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[])) and exists(select 1 from public.kos_documents d where d.id=document_id and d.workspace_id=kos_document_derivatives.workspace_id)) with check(public.kos_has_role(workspace_id,array['owner','admin','member']::public.kos_workspace_role[]) and exists(select 1 from public.kos_documents d where d.id=document_id and d.workspace_id=kos_document_derivatives.workspace_id));
create policy kos_document_derivatives_delete on public.kos_document_derivatives for delete to authenticated using(requested_by=(select auth.uid()) or public.kos_has_role(workspace_id,array['owner','admin']::public.kos_workspace_role[]));
grant select,insert,update,delete on public.kos_document_derivatives to authenticated;
