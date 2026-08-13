import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planDocumentationRepair } from "../../lib/documentation-repair.mjs";

const policy = JSON.parse(await readFile(new URL("../../config/documentation-repair-policy.json", import.meta.url), "utf8"));
const proposal = {
  fields: ["commit_sha"],
  source_ref: "github:commit",
  observed_at: "2026-08-13T12:00:00Z",
  previous_value: "old",
  proposed_value: "new",
  actor: "documentation-integrity-v1",
  idempotency_key: "repair-1",
  target_version: "v1"
};

test("low-risk factual repair is automatic and reversible", () => {
  const plan = planDocumentationRepair(policy, { id: "green", severity: "GREEN" }, proposal);
  assert.equal(plan.disposition, "automatic");
  assert.equal(plan.rollback.restore_value, "old");
});

test("security, tenant and migration history repairs are blocked", () => {
  for (const field of ["permissions", "tenant_scope", "migration_history"]) {
    const plan = planDocumentationRepair(policy, { id: field, severity: "RED" }, { ...proposal, fields: [field] });
    assert.equal(plan.disposition, "blocked");
    assert.equal(plan.requires_approval, true);
  }
});

test("missing provenance blocks repair", () => {
  const plan = planDocumentationRepair(policy, { id: "missing", severity: "GREEN" }, { ...proposal, source_ref: "" });
  assert.equal(plan.disposition, "blocked");
  assert.deepEqual(plan.missing_evidence, ["source_ref"]);
});
