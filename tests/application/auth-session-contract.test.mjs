import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browserClient = await readFile(new URL("../../lib/supabase-browser.ts", import.meta.url), "utf8");
const authDesk = await readFile(new URL("../../components/auth-desk.tsx", import.meta.url), "utf8");
const callback = await readFile(new URL("../../app/auth/callback/route.ts", import.meta.url), "utf8");

test("browser and server share the SSR cookie session model", () => {
  assert.match(browserClient, /createBrowserClient/);
  assert.doesNotMatch(browserClient, /createClient/);
});

test("magic links use a code exchange callback before opening the workspace", () => {
  assert.match(authDesk, /\/auth\/callback\?next=\/workspace/);
  assert.match(callback, /exchangeCodeForSession/);
});

test("callback prevents open redirects and reports invalid links", () => {
  assert.match(callback, /!requestedNext\.startsWith\("\/\/"\)/);
  assert.match(callback, /invalid_or_expired_link/);
});
