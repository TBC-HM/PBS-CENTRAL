import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const canonical=await readFile(new URL("../../supabase/migrations/20260814000423_universal_intake_canonical_representation.sql",import.meta.url),"utf8");
const upload=await readFile(new URL("../../supabase/migrations/20260813152000_document_upload_registration.sql",import.meta.url),"utf8");
const router=await readFile(new URL("../../supabase/migrations/20260814000800_universal_intake_router.sql",import.meta.url),"utf8");
const review=await readFile(new URL("../../supabase/migrations/20260814002111_intake_confidence_review.sql",import.meta.url),"utf8");const documents=await readFile(new URL("../../app/workspace/documents/page.tsx",import.meta.url),"utf8");const actions=await readFile(new URL("../../app/workspace/documents/actions.ts",import.meta.url),"utf8");
const reviewPrivileges=await readFile(new URL("../../supabase/migrations/20260814002446_intake_confidence_review_privileges.sql",import.meta.url),"utf8");
const evaluation=await readFile(new URL("../../supabase/migrations/20260814002842_intake_correction_evaluation_loop.sql",import.meta.url),"utf8");

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

test("field confidence enforces mandatory high-risk review and tenant-bound provenance",()=>{assert.match(review,/when 'standard' then \.80 when 'identity' then \.92 else 1\.00/);for(const risk of ["legal","financial","identity","restricted"])assert.match(review,new RegExp(risk));assert.match(review,/foreign key\(workspace_id,document_version_id\)/);assert.match(review,/foreign key\(workspace_id,representation_id\)/)});
test("owner-admin review supports audited approve correct and reject decisions",()=>{for(const label of ["Human review queue","Approve","Correct","Reject","Save audited review"])assert.match(documents,new RegExp(label));assert.match(actions,/kos_resolve_extraction_review/);assert.match(review,/owner or admin required/);assert.match(review,/review reason required/);assert.match(review,/extraction_review_resolved/);assert.match(review,/from public,anon/);assert.match(reviewPrivileges,/alter function public\.kos_record_extraction_review[^;]+ security definer/);assert.match(reviewPrivileges,/alter function public\.kos_resolve_extraction_review[^;]+ security definer/);assert.match(reviewPrivileges,/revoke all on public\.kos_extraction_reviews from public,anon,authenticated/);assert.doesNotMatch(reviewPrivileges,/grant (insert|update)/)});
test("correction learning requires sufficient reviewed evidence and deterministic rules first",()=>{assert.match(evaluation,/total<20 then 'insufficient_evidence'/);assert.match(evaluation,/rate>=\.15 then 'adjust_deterministic_rule'/);assert.match(evaluation,/At least 20 reviewed examples/);assert.match(evaluation,/deterministic rule adjustment first/);assert.match(evaluation,/requires_owner_approval boolean not null default true/);assert.match(evaluation,/owner or admin required/);assert.match(evaluation,/extraction_corrections_evaluated/);assert.doesNotMatch(evaluation,/automatic.*train|self.train/i)});

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
