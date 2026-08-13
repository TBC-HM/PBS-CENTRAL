import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../../app/workspace/settings/page.tsx", import.meta.url), "utf8");
const actions = await readFile(new URL("../../app/workspace/settings/actions.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/migrations/20260813233128_settings_phase_a_control_plane.sql", import.meta.url), "utf8");

test("settings exposes the governed Phase A control-plane sections", () => {
  for (const label of ["Workspace", "People & access", "Data structure", "Integrations", "Audit & operations", "Policy roadmap"])
    assert.match(page, new RegExp(label.replace("&", "&")));
  for (const source of ["kos_workspace_members", "kos_workspace_settings", "kos_integrations", "kos_audit_events"])
    assert.match(page, new RegExp(source));
});

test("settings mutations use guarded RPCs and require an audit reason", () => {
  assert.match(actions, /kos_update_workspace_profile/);
  assert.match(actions, /kos_update_workspace_setting/);
  assert.match(page, /Reason for change/);
  assert.match(migration, /change reason required/);
  assert.match(migration, /workspace_profile_updated/);
  assert.match(migration, /workspace_setting_updated/);
  assert.doesNotMatch(actions, /from\("kos_workspace_settings"\)\.update/);
});

test("settings RPCs are tenant-role checked and deny anonymous execution", () => {
  assert.equal((migration.match(/security invoker/g) ?? []).length, 2);
  assert.equal((migration.match(/kos_has_role\(target_workspace,array\['owner','admin'/g) ?? []).length, 2);
  for (const rpc of ["kos_update_workspace_profile", "kos_update_workspace_setting"]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${rpc}[^;]+ from public,anon`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}[^;]+ to authenticated`));
  }
});
