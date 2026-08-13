import assert from "node:assert/strict";
import test from "node:test";
import { compareDocumentationState } from "../../lib/documentation-drift.mjs";

const contract = { version: 1, canonicalRepository: "TBC-HM/PBS-CENTRAL", supabaseProject: "gjxifmrqnzcrdhykpxqn", vercelProject: "pbs-central-knowledge-os-preview" };
const current = {
  github: { repository: contract.canonicalRepository, mainSha: "abc", evidenceRef: "github:abc" },
  supabase: { project: contract.supabaseProject, repositoryMigrations: ["1"], liveMigrations: ["1"], rlsVerified: true, evidenceRef: "supabase:1" },
  vercel: { project: contract.vercelProject, sourceSha: "abc", state: "READY", evidenceRef: "vercel:1" },
  documentation: { authorityVersion: 1, canonicalRepository: contract.canonicalRepository, evidenceRef: "doc:1" }
};

test("matching live sources produce GREEN with evidence references", () => {
  const result = compareDocumentationState(contract, current);
  assert.equal(result.health, "GREEN");
  assert.equal(result.records.length, 4);
  assert.ok(result.records.every(({ evidence_ref }) => evidence_ref));
});

test("wrong repository or tenant security evidence produces RED", () => {
  const wrongRepository = structuredClone(current);
  wrongRepository.github.repository = "unapproved/repository";
  assert.equal(compareDocumentationState(contract, wrongRepository).health, "RED");

  const rlsMissing = structuredClone(current);
  rlsMissing.supabase.rlsVerified = false;
  assert.equal(compareDocumentationState(contract, rlsMissing).health, "RED");
});

test("deployment lag produces AMBER without weakening the source contract", () => {
  const lagging = structuredClone(current);
  lagging.vercel.sourceSha = "old";
  assert.equal(compareDocumentationState(contract, lagging).health, "AMBER");
});
