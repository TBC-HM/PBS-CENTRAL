-- Universal Intake canonical representations augment immutable originals.
create unique index if not exists kos_document_versions_workspace_identity on public.kos_document_versions(workspace_id,id);
create table public.kos_document_representations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
  document_id uuid not null,
  document_version_id uuid not null,
  representation_kind text not null check (representation_kind in ('markdown','structured_json','table','transcript','keyframes','archive_manifest','email_structure')),
  schema_version text not null default 'canonical_v1',
  status text not null default 'pending' check (status in ('pending','processing','ready','review_required','failed','superseded')),
  content_text text,
  content_json jsonb not null default '{}'::jsonb,
  language text,
  extractor text not null,
  extractor_version text not null,
  source_sha256 text not null,
  quality jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(document_version_id,representation_kind,schema_version),
  unique(workspace_id,id),
  foreign key(workspace_id,document_id) references public.kos_documents(workspace_id,id) on delete cascade,
  foreign key(workspace_id,document_version_id) references public.kos_document_versions(workspace_id,id) on delete cascade
);
create index kos_document_representations_lookup on public.kos_document_representations(workspace_id,document_id,status);

create table public.kos_document_segments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kos_workspaces(id) on delete cascade,
  representation_id uuid not null,
  ordinal integer not null check (ordinal >= 0),
  segment_type text not null check (segment_type in ('page','paragraph','heading','table','sheet','cell_range','slide','message','attachment','chapter','utterance','frame','archive_entry')),
  text_content text,
  structured_content jsonb not null default '{}'::jsonb,
  citation jsonb not null,
  token_count integer check (token_count is null or token_count >= 0),
  created_at timestamptz not null default now(),
  unique(representation_id,ordinal),
  foreign key(workspace_id,representation_id) references public.kos_document_representations(workspace_id,id) on delete cascade
);
create index kos_document_segments_retrieval on public.kos_document_segments(workspace_id,representation_id,ordinal);

alter table public.kos_document_representations enable row level security;
alter table public.kos_document_segments enable row level security;
create policy kos_document_representations_read on public.kos_document_representations for select to authenticated using(public.kos_is_member(workspace_id));
create policy kos_document_segments_read on public.kos_document_segments for select to authenticated using(public.kos_is_member(workspace_id));
revoke all on public.kos_document_representations,public.kos_document_segments from public,anon,authenticated;
grant select on public.kos_document_representations,public.kos_document_segments to authenticated;

comment on table public.kos_document_representations is 'Versioned canonical derivatives. Original objects in knowledge-originals remain immutable system evidence.';
comment on column public.kos_document_segments.citation is 'Required source locator: page/bbox, sheet/range, slide/shape, message/attachment, archive path, or timestamp range.';
