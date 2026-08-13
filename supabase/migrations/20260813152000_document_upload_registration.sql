create or replace function public.kos_register_uploaded_document(
  target_workspace uuid,
  document_id_value uuid,
  version_id_value uuid,
  title_value text,
  document_type_value text,
  object_path_value text,
  original_filename_value text,
  media_type_value text,
  byte_size_value bigint,
  sha256_value text
)
returns table(document_id uuid, version_id uuid)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.kos_has_role(target_workspace, array['owner','admin','member']::public.kos_workspace_role[]) then
    raise exception 'workspace membership with write access is required';
  end if;
  if title_value is null or btrim(title_value) = '' then raise exception 'document title is required'; end if;
  if original_filename_value is null or btrim(original_filename_value) = '' then raise exception 'original filename is required'; end if;
  if byte_size_value is null or byte_size_value < 1 or byte_size_value > 524288000 then raise exception 'file size is outside the 1 byte to 500 MB limit'; end if;
  if sha256_value !~ '^[0-9a-f]{64}$' then raise exception 'valid SHA-256 is required'; end if;
  if object_path_value not like target_workspace::text || '/%' then raise exception 'invalid tenant-scoped object path'; end if;
  if not exists (select 1 from storage.objects where bucket_id='knowledge-originals' and name=object_path_value) then
    raise exception 'uploaded original was not found';
  end if;

  insert into public.kos_documents(id,workspace_id,title,document_type,status,visibility,classification_method,created_by)
  values(document_id_value,target_workspace,btrim(title_value),nullif(btrim(document_type_value),''),'draft','workspace','owner_upload',actor);
  insert into public.kos_document_versions(id,workspace_id,document_id,version_number,bucket_id,object_path,original_filename,media_type,byte_size,sha256,extraction_status,created_by)
  values(version_id_value,target_workspace,document_id_value,1,'knowledge-originals',object_path_value,original_filename_value,nullif(media_type_value,''),byte_size_value,sha256_value,'pending',actor);
  return query select document_id_value, version_id_value;
end;
$$;

revoke all on function public.kos_register_uploaded_document(uuid,uuid,uuid,text,text,text,text,text,bigint,text) from public;
revoke all on function public.kos_register_uploaded_document(uuid,uuid,uuid,text,text,text,text,text,bigint,text) from anon;
grant execute on function public.kos_register_uploaded_document(uuid,uuid,uuid,text,text,text,text,text,bigint,text) to authenticated;
