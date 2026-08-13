import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policy = JSON.parse(await readFile(new URL("../../config/documentation-authority.json", import.meta.url), "utf8"));

test("documentation authority is pinned to authorized PBS CENTRAL resources", () => {
  assert.equal(policy.canonicalRepository, "TBC-HM/PBS-CENTRAL");
  assert.equal(policy.supabaseProject, "gjxifmrqnzcrdhykpxqn");
  assert.equal(policy.vercelProject, "pbs-central-knowledge-os-preview");
});

test("security and tenant meaning cannot be auto-repaired", () => {
  assert.equal(policy.severity.RED.automaticRepair, false);
  for (const field of ["permissions", "rls_policy", "security_boundary", "tenant_scope"])
    assert.ok(policy.protectedMeaning.includes(field));
});
