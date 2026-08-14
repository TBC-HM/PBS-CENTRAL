import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const canonical=await readFile(new URL("../../supabase/migrations/20260814000423_universal_intake_canonical_representation.sql",import.meta.url),"utf8");
const upload=await readFile(new URL("../../supabase/migrations/20260813152000_document_upload_registration.sql",import.meta.url),"utf8");
const router=await readFile(new URL("../../supabase/migrations/20260814000800_universal_intake_router.sql",import.meta.url),"utf8");

test("universal intake preserves immutable originals and versions canonical derivatives",()=>{
  assert.match(upload,/knowledge-originals/);
  assert.match(canonical,/foreign key\(workspace_id,document_version_id\) references public\.kos_document_versions\(workspace_id,id\)/);
  assert.match(canonical,/source_sha256 text not null/);
  assert.match(canonical,/schema_version text not null/);
  assert.match(canonical,/unique\(document_version_id,representation_kind,schema_version\)/);
});

test("deterministic router covers native documents, tables, media, email and archives with fallback",()=>{
  for(const route of ["ocr_layout","document_parser","spreadsheet_parser","presentation_parser","email_parser","archive_manifest","audio_transcription","video_transcription_keyframes","quarantine_manual_review"])assert.match(router,new RegExp(route));
  assert.match(router,/document version not found in workspace/);
  assert.match(router,/review_on_validation_failure/);
});

test("router creates tenant-scoped idempotent audited jobs",()=>{
  assert.match(router,/kos_has_role\(target_workspace/);
  assert.match(router,/unique index if not exists kos_processing_jobs_workspace_idempotency/);
  assert.match(router,/intake:'\|\|v\.id::text\|\|':'\|\|v\.sha256\|\|':router_v1/);
  assert.match(router,/on conflict\(workspace_id,idempotency_key\)/);
  assert.match(router,/document_intake_routed/);
  assert.match(router,/from public,anon/);
});

test("canonical representations cover document, spreadsheet, media, email and archive structures",()=>{
  for(const kind of ["markdown","structured_json","table","transcript","keyframes","archive_manifest","email_structure"])assert.match(canonical,new RegExp(kind));
  for(const segment of ["page","sheet","cell_range","slide","message","attachment","chapter","utterance","frame","archive_entry"])assert.match(canonical,new RegExp(segment));
});

test("every canonical segment requires a source citation and tenant-scoped reads",()=>{
  assert.match(canonical,/citation jsonb not null/);
  assert.match(canonical,/page\/bbox, sheet\/range, slide\/shape/);
  assert.equal((canonical.match(/enable row level security/g)??[]).length,2);
  assert.equal((canonical.match(/kos_is_member\(workspace_id\)/g)??[]).length,2);
  assert.match(canonical,/revoke all on public\.kos_document_representations,public\.kos_document_segments from public,anon,authenticated/);
  assert.match(canonical,/foreign key\(workspace_id,representation_id\) references public\.kos_document_representations\(workspace_id,id\)/);
});
