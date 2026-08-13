import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../../app/workspace/page.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("../../components/workspace-shell.tsx", import.meta.url), "utf8");

test("Second Brain UI is wired to existing workspace-scoped PBS CENTRAL data", () => {
  for (const table of ["kos_documents", "kos_agent_sessions", "kos_agent_handovers", "kos_knowledge_sources", "kos_companies", "kos_contacts", "kos_company_aliases", "kos_company_relationships"])
    assert.match(page, new RegExp(table));
  assert.match(page, /\.eq\("workspace_id", workspace\.id\)/);
});

test("organization and relationships provide directories and entity landing CTAs", () => {
  for (const label of ["Company directory", "Relationship desk", "Open contact", "Open company overview", "Find related documents", "Send email", "Call", "WhatsApp"])
    assert.match(shell, new RegExp(label));
});

test("relationship desk exposes operational contact groups, profile actions and safe headings", async () => {
  for (const label of ["All contacts", "Main contacts", "Company-associated", "Email-ready", "Phone & WhatsApp", "Needs identification", "Needs company assignment", "Advisers & team", "Possible duplicates", "Select email-ready in view", "Compose BCC email", "Open full profile", "Copy details", "Data quality"])
    assert.match(shell, new RegExp(label.replace("&", "&")));
  const css = await readFile(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.app-header h1[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.entity-landing h2[^}]*overflow-wrap: anywhere/);
});

test("Second Brain exposes usable navigation and CTAs", () => {
  for (const label of ["Browse documents", "Open session memory", "View provenance", "View document relationships", "Download latest", "Find related documents", "Open company overview"])
    assert.match(shell, new RegExp(label));
  for (const view of ["knowledge", "documents", "memory", "sessions"])
    assert.match(shell, new RegExp(`\\"${view}\\"`));
});

test("main workspace visibly links to deployed operational surfaces", async () => {
  const page = await readFile(new URL("../../app/workspace/page.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../../components/workspace-shell.tsx", import.meta.url), "utf8");
  for (const route of ["/workspace/upload", "/workspace/automations", "/workspace/companies/"])
    assert.match(page + shell, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(shell, /Open automation control room/);
});

test("organization is a company tile portfolio that opens permanent dossiers", async () => {
  const shell = await readFile(new URL("../../components/workspace-shell.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../../app/workspace/page.tsx", import.meta.url), "utf8");
  assert.match(shell, /CompanyTileDirectory/);
  assert.match(shell, /company-tile-grid/);
  assert.match(shell, /Open company overview/);
  assert.match(shell, /workspace\/companies\/\$\{item\.id\}/);
  assert.doesNotMatch(page, /workspace-shortcuts|upload-shortcut/);
});

test("empty workflow states route users to a recovery action", () => {
  for (const label of ["Open Knowledge", "Review Inbox", "Open Work"])
    assert.match(shell, new RegExp(label));
});

test("companies and contacts have permanent governed routes", async () => {
  const companyPage = await readFile(new URL("../../app/workspace/companies/[id]/page.tsx", import.meta.url), "utf8");
  const contactPage = await readFile(new URL("../../app/workspace/contacts/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(companyPage, /kos_companies/);
  assert.match(companyPage, /workspace\/contacts/);
  assert.match(contactPage, /kos_contacts/);
  assert.match(contactPage, /workspace\/companies/);
  assert.match(companyPage + contactPage, /getClaims/);
});

test("contact profiles support tenant-safe editing, notes and follow-ups", async () => {
  const operations = await readFile(new URL("../../components/contact-operations.tsx", import.meta.url), "utf8");
  const contactPage = await readFile(new URL("../../app/workspace/contacts/[id]/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../supabase/migrations/20260813204528_contact_operations.sql", import.meta.url), "utf8");
  const hardening = await readFile(new URL("../../supabase/migrations/20260813204855_contact_operations_security_invoker.sql", import.meta.url), "utf8");
  for (const rpc of ["kos_update_contact", "kos_add_contact_note", "kos_create_follow_up"]) assert.match(operations + migration, new RegExp(rpc));
  for (const label of ["Save audited changes", "Add governed note", "Create audited follow-up"]) assert.match(operations, new RegExp(label));
  assert.match(contactPage, /kos_contact_notes/); assert.match(contactPage, /kos_follow_ups/);
  assert.match(migration, /enable row level security/g); assert.match(migration, /kos_has_role/); assert.match(migration, /kos_audit_events/);
  assert.match(migration, /contact not found in workspace/); assert.match(migration, /company not found in workspace/);
  assert.equal((hardening.match(/security invoker/g) ?? []).length, 3);
});

test("company dossier exposes legal, people, relationship, banking and obligation sections", async () => {
  const page = await readFile(new URL("../../app/workspace/companies/[id]/page.tsx", import.meta.url), "utf8");
  for (const source of ["kos_document_links", "kos_company_relationships", "kos_bank_accounts", "kos_contacts"])
    assert.match(page, new RegExp(source));
  for (const section of ["Legal identity", "Legal documents", "Main contacts", "Ownership & advisers", "Banking", "Pending obligations"])
    assert.match(page, new RegExp(section));
  assert.match(page, /legacy task table is intentionally excluded/i);
});

test("document upload uses private tenant-scoped storage and atomic registry RPC", async () => {
  const upload = await readFile(new URL("../../components/document-upload.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../supabase/migrations/20260813152000_document_upload_registration.sql", import.meta.url), "utf8");
  assert.match(upload, /knowledge-originals/);
  assert.match(upload, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(upload, /kos_register_uploaded_document/);
  assert.match(upload, /remove\(\[objectPath\]\)/);
  assert.match(migration, /kos_has_role/);
  assert.match(migration, /target_workspace::text \|\| '\/%'/);
  assert.match(migration, /storage\.objects/);
});

test("document intake accepts multi-file and full-folder batches", async () => {
  const upload = await readFile(new URL("../../components/document-upload.tsx", import.meta.url), "utf8");
  assert.match(upload, /multiple/);
  assert.match(upload, /webkitdirectory/);
  assert.match(upload, /webkitGetAsEntry/);
  assert.match(upload, /filesFromEntry/);
  assert.match(upload, /relativePath/);
  assert.match(upload, /All file types are accepted/);
  assert.doesNotMatch(upload, /accept=/);
});

test("documents have a company tree and governed company assignment", async () => {
  const library = await readFile(new URL("../../components/document-library.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../../app/workspace/documents/page.tsx", import.meta.url), "utf8");
  const company = await readFile(new URL("../../app/workspace/companies/[id]/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../supabase/migrations/20260813203251_company_document_library.sql", import.meta.url), "utf8");
  assert.match(library, /Unassigned uploads/);
  assert.match(library, /Assign to company/);
  assert.match(library, /kos_assign_document_company/);
  assert.match(page, /kos_document_versions/);
  assert.match(company, /upload\?company=/);
  assert.match(migration, /document not found in workspace/);
  assert.match(migration, /company not found in workspace/);
});

test("automation control uses tenant-checked idempotent workflow RPCs", async () => {
  const control = await readFile(new URL("../../components/automation-control.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../supabase/migrations/20260813161000_governed_workflow_control.sql", import.meta.url), "utf8");
  assert.match(control, /kos_create_workflow/);
  assert.match(control, /kos_queue_workflow/);
  assert.match(migration, /kos_has_role/);
  assert.match(migration, /kos_workflow_runs_idempotency/);
  assert.match(migration, /on conflict\(workspace_id,idempotency_key\)/);
  assert.match(migration, /from public,anon/);
});

test("automation library contains approved operational starter workflows", async () => {
  const control = await readFile(new URL("../../components/automation-control.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../supabase/migrations/20260813194356_seed_pbs_central_automation_library.sql", import.meta.url), "utf8");
  for (const name of ["Morning briefing", "Document intake & classification", "Company registry monitoring", "Company relationship research", "Compliance obligation review", "Knowledge integrity review"])
    assert.match(migration, new RegExp(name.replace(/[&]/g, "&")));
  assert.match(migration, /where workspace\.slug = 'pbs-central'/);
  assert.match(migration, /on conflict \(workspace_id, slug, version\) do update/);
  assert.match(control, /Run automation/);
  assert.match(control, /requires_approval/);
});
