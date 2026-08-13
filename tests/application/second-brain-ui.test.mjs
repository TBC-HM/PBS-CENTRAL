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
  for (const label of ["Company directory", "Contact directory", "Open contact", "Open company page", "Find related documents", "Send email", "Call", "WhatsApp"])
    assert.match(shell, new RegExp(label));
});

test("Second Brain exposes usable navigation and CTAs", () => {
  for (const label of ["Browse documents", "Open session memory", "View provenance", "View document relationships", "Download latest", "Find related documents", "Open company page"])
    assert.match(shell, new RegExp(label));
  for (const view of ["knowledge", "documents", "memory", "sessions"])
    assert.match(shell, new RegExp(`\\"${view}\\"`));
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
