"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type WorkflowDefinition = {
  category?: string;
  summary?: string;
  schedule?: string;
  requires_approval?: boolean;
  steps?: Array<{ type?: string }>;
};
type Workflow = { id: string; slug: string; name: string; status: string; version: number; definition: WorkflowDefinition };
type Run = { id: string; workflow_id: string; status: string; created_at: string; idempotency_key: string | null };

export function AutomationControl({ workspaceId, role, initialWorkflows, initialRuns }: { workspaceId: string; role: string; initialWorkflows: Workflow[]; initialRuns: Run[] }) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [runs, setRuns] = useState(initialRuns);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const canCreate = role === "owner" || role === "admin";

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data, error } = await (getSupabaseBrowserClient() as any).rpc("kos_create_workflow", { target_workspace: workspaceId, slug_value: slug, name_value: name.trim(), definition_value: { category: "Custom", summary: "Owner-defined governed workflow.", trigger: "manual", schedule: "On demand", requires_approval: true, steps: [{ type: "governed_handover" }] } });
      if (error) throw error;
      setWorkflows((items) => [data, ...items]);
      setName("");
      setMessage("Active governed workflow created.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Workflow could not be created."); }
    finally { setBusy(false); }
  }

  async function run(workflow: Workflow) {
    setBusy(true);
    setMessage("");
    try {
      const key = `manual-${workflow.id}-${new Date().toISOString().slice(0, 16)}`;
      const { data, error } = await (getSupabaseBrowserClient() as any).rpc("kos_queue_workflow", { target_workspace: workspaceId, target_workflow: workflow.id, input_value: { source: "automation_control", requested_at: new Date().toISOString() }, idempotency_key_value: key });
      if (error) throw error;
      setRuns((items) => [data, ...items.filter((item) => item.id !== data.id)]);
      setMessage(`${workflow.name} queued once. Its governed steps and approval gates are now recorded.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Workflow could not be queued."); }
    finally { setBusy(false); }
  }

  return <section className="automation-control">
    <article className="automation-intro"><p className="eyebrow">Automation library</p><h2>{workflows.length} governed workflows</h2><p>Each workflow is tenant-scoped, audit-ready and explicit about approval. Running a workflow creates one idempotent run record.</p></article>
    <article><p className="eyebrow">Create</p><form onSubmit={create}><label><span>New automation name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Monthly document review" /></label><button disabled={!canCreate || busy || !name.trim()}>Create active automation</button></form>{!canCreate && <p className="permission-note">Owner or admin permission is required.</p>}</article>
    <div className="automation-card-grid entity-page-wide">{workflows.length ? workflows.map((workflow) => <article className="automation-card" key={workflow.id}><div><p className="eyebrow">{workflow.definition.category ?? "Automation"}</p><h3>{workflow.name}</h3><p>{workflow.definition.summary ?? "Governed workspace workflow."}</p></div><dl><div><dt>Schedule</dt><dd>{workflow.definition.schedule ?? "On demand"}</dd></div><div><dt>Approval</dt><dd>{workflow.definition.requires_approval ? "Required" : "Not required"}</dd></div><div><dt>Steps</dt><dd>{workflow.definition.steps?.length ?? 0}</dd></div></dl><button disabled={busy || workflow.status !== "active"} onClick={() => run(workflow)}>Run automation</button></article>) : <div className="empty-state"><p>No automation exists yet.</p><span>The PBS Central starter library has not been installed.</span></div>}</div>
    <article className="entity-page-wide"><p className="eyebrow">Recent runs</p><div className="automation-list">{runs.length ? runs.map((run) => <div key={run.id}><span><strong>{workflows.find((item) => item.id === run.workflow_id)?.name ?? "Workflow"}</strong><small>{new Date(run.created_at).toLocaleString()}</small></span><em>{run.status}</em></div>) : <p>No workflow runs yet. Choose an automation above to create the first governed run.</p>}</div></article>
    <p className="form-message" role="status">{message}</p>
  </section>;
}
