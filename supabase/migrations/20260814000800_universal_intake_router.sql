alter table public.kos_processing_jobs add column if not exists idempotency_key text;
create unique index if not exists kos_processing_jobs_workspace_idempotency
on public.kos_processing_jobs(workspace_id,idempotency_key) where idempotency_key is not null;

create or replace function public.kos_route_document_intake(target_workspace uuid,target_version uuid)
returns public.kos_processing_jobs language plpgsql security invoker set search_path='' as $$
declare v public.kos_document_versions;route text;representations jsonb;job public.kos_processing_jobs;key text;
begin
 if not public.kos_has_role(target_workspace,array['owner','admin','member']::public.kos_workspace_role[]) then raise exception 'write membership required' using errcode='42501'; end if;
 select * into v from public.kos_document_versions where id=target_version and workspace_id=target_workspace;
 if v.id is null then raise exception 'document version not found in workspace' using errcode='P0002'; end if;
 route:=case
  when v.media_type in ('application/pdf','image/jpeg','image/png','image/tiff','image/webp') then 'ocr_layout'
  when v.media_type in ('application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','application/rtf','text/plain','text/markdown','text/html') then 'document_parser'
  when v.media_type in ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv') then 'spreadsheet_parser'
  when v.media_type in ('application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-powerpoint') then 'presentation_parser'
  when v.media_type='message/rfc822' then 'email_parser'
  when v.media_type in ('application/zip','application/x-tar','application/gzip','application/x-7z-compressed') then 'archive_manifest'
  when v.media_type like 'audio/%' then 'audio_transcription'
  when v.media_type like 'video/%' then 'video_transcription_keyframes'
  else 'quarantine_manual_review' end;
 representations:=case route
  when 'ocr_layout' then '["markdown","structured_json"]'::jsonb
  when 'document_parser' then '["markdown","structured_json"]'::jsonb
  when 'spreadsheet_parser' then '["table","structured_json"]'::jsonb
  when 'presentation_parser' then '["markdown","structured_json"]'::jsonb
  when 'email_parser' then '["email_structure","markdown"]'::jsonb
  when 'archive_manifest' then '["archive_manifest"]'::jsonb
  when 'audio_transcription' then '["transcript"]'::jsonb
  when 'video_transcription_keyframes' then '["transcript","keyframes"]'::jsonb
  else '[]'::jsonb end;
 key:='intake:'||v.id::text||':'||v.sha256||':router_v1';
 insert into public.kos_processing_jobs(workspace_id,job_type,resource_type,resource_id,status,priority,max_attempts,payload,idempotency_key)
 values(target_workspace,'universal_document_intake','document_version',v.id,'queued',50,3,jsonb_build_object('router_version','router_v1','route',route,'representations',representations,'media_type',v.media_type,'filename',v.original_filename,'source_sha256',v.sha256,'fallback',case when route='quarantine_manual_review' then 'operator_review' else 'review_on_validation_failure' end),key)
 on conflict(workspace_id,idempotency_key) where idempotency_key is not null do update set payload=excluded.payload
 returning * into job;
 update public.kos_document_versions set extraction_status=case when route='quarantine_manual_review' then 'review_required' else 'queued' end where id=v.id;
 insert into public.kos_audit_events(workspace_id,actor_user_id,action,resource_type,resource_id,details) values(target_workspace,(select auth.uid()),'document_intake_routed','document_version',v.id,jsonb_build_object('route',route,'job_id',job.id,'idempotency_key',key));
 return job;
end $$;

revoke all on function public.kos_route_document_intake(uuid,uuid) from public,anon;
grant execute on function public.kos_route_document_intake(uuid,uuid) to authenticated;
