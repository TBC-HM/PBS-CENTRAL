import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("registry documents distinguish inline preview from attachment download", async () => {
  const route = await readFile(
    new URL("../../app/api/documents/[id]/preview/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /searchParams\.get\("download"\)/);
  assert.match(route, /storage\.from\(version\.bucket_id\)\.download/);
  assert.match(route, /inline/);
  assert.match(route, /attachment/);
  assert.match(route, /original_filename/);
  assert.match(route, /media_type/);
});

test("knowledge reports have authenticated preview and download surfaces", async () => {
  const preview = await readFile(
    new URL("../../app/workspace/knowledge/[id]/page.tsx", import.meta.url),
    "utf8",
  );
  const download = await readFile(
    new URL("../../app/api/knowledge/[id]/download/route.ts", import.meta.url),
    "utf8",
  );
  const actions = await readFile(
    new URL("../../components/document-actions.tsx", import.meta.url),
    "utf8",
  );
  assert.match(preview, /MarkdownReport/);
  assert.match(preview, /getClaims/);
  assert.match(download, /Content-Disposition/);
  assert.match(download, /text\/markdown/);
  assert.match(actions, /Preview/);
  assert.match(actions, /Download/);
});
