import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateMemoryTransition, retentionDisposition } from "../../lib/memory-lifecycle.mjs";

const contract = JSON.parse(await readFile(new URL("../../config/memory-lifecycle.json", import.meta.url), "utf8"));
const base = { workspace_id: "workspace-a", source_refs: ["knowledge:item-1"], actor_type: "human", actor_role: "owner" };

test("original evidence remains outside the memory hierarchy", () => {
  assert.equal(contract.evidenceIsMemory, false);
  assert.ok(contract.canonicalAuthority.includes("kos_document_versions"));
});

test("confidence never authorizes promotion and agents cannot self-promote", () => {
  assert.equal(contract.rules.confidenceAuthorizesPromotion, false);
  const result = evaluateMemoryTransition(contract, { ...base, from: "candidate", to: "verified", actor_type: "agent", confidence: 1, approval_id: "approval-1" });
  assert.deepEqual(result, { allowed: false, reason: "agents_cannot_self_promote" });
});

test("verified promotion requires workspace, provenance, role and approval", () => {
  for (const request of [
    { ...base, workspace_id: "", from: "candidate", to: "verified", approval_id: "approval-1" },
    { ...base, source_refs: [], from: "candidate", to: "verified", approval_id: "approval-1" },
    { ...base, actor_role: "member", from: "candidate", to: "verified", approval_id: "approval-1" },
    { ...base, from: "candidate", to: "verified" }
  ]) assert.equal(evaluateMemoryTransition(contract, request).allowed, false);

  assert.equal(evaluateMemoryTransition(contract, { ...base, from: "candidate", to: "verified", approval_id: "approval-1" }).allowed, true);
});

test("legal hold overrides automatic expiry", () => {
  const expired = { tier: "candidate", expires_at: "2026-01-01T00:00:00Z" };
  assert.equal(retentionDisposition(contract, expired, new Date("2026-08-13T00:00:00Z")).action, "expire");
  assert.deepEqual(retentionDisposition(contract, { ...expired, state: "legal_hold" }), { action: "retain", reason: "legal_hold" });
});
