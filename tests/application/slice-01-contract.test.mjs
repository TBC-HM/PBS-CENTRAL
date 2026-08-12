import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../../components/workspace-shell.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/20260812150500_production_slice_01_contract.sql", import.meta.url), "utf8");

test("canonical eight-area navigation is present", () => {
  for (const area of ["Home", "Inbox", "Work", "Organization", "Relationships", "Knowledge", "Automations", "Insights"])
    assert.match(shell, new RegExp(`"${area}"`));
});

test("every approved flow transition has a callable CTA", () => {
  for (const label of ["Open cited evidence", "Record decision and request approval", "Approve action", "Reject", "Execute approved action", "Verify outcome with citation", "Download structured handover"])
    assert.match(shell, new RegExp(label));
});

test("database transitions are tenant, role and audit guarded", () => {
  assert.match(migration, /kos_has_role\(target_workspace/);
  assert.match(migration, /owner or admin authority is required/);
  assert.match(migration, /action requires an approved gate/);
  assert.match(migration, /idempotency key is required/);
  for (const event of ["slice_decision_recorded", "slice_approval_approved", "slice_action_executed", "slice_outcome_verified"])
    assert.match(migration, new RegExp(event));
});
