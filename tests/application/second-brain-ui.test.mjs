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
