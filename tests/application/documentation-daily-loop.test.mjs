import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../../.github/workflows/documentation-integrity.yml", import.meta.url), "utf8");
const collector = await readFile(new URL("../../scripts/collect-documentation-evidence.mjs", import.meta.url), "utf8");

test("daily loop is scheduled, serialized and preserves audit evidence", () => {
  assert.match(workflow, /cron: "17 5 \* \* \*"/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /upload-artifact@v4/);
  assert.match(workflow, /retention-days: 30/);
});

test("collector is limited to authorized PBS CENTRAL resources and bounded retries", () => {
  for (const value of ["TBC-HM/PBS-CENTRAL", "gjxifmrqnzcrdhykpxqn", "pbs-central-knowledge-os-preview"])
    assert.match(collector, new RegExp(value.replaceAll("/", "\\/")));
  assert.match(collector, /attempts = 3/);
  assert.match(collector, /missing_credentials/);
});
