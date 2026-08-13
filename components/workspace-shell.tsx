"use client";

import { FormEvent, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { SignOutButton } from "@/components/sign-out-button";

type Evidence = { id: string; title: string; body: string; verification_status: string };
type Approval = { id: string; subject_id: string; action: string; status: string; rationale: string | null };
type Job = { id: string; resource_id: string; result: Record<string, unknown> | null };
type DecisionResult = { decision_id: string; approval_id: string };
type ActionResult = { job_id: string; replayed: boolean };

const areas = ["Home", "Inbox", "Work", "Organization", "Relationships", "Knowledge", "Automations", "Insights"];

export function WorkspaceShell({ workspace, role, evidence, approvals, jobs }: {
  workspace: { id: string; name: string; slug: string };
  role: string;
  evidence: Evidence[];
  approvals: Approval[];
  jobs: Job[];
}) {
  const [area, setArea] = useState("Home");
  const [selectedEvidence, setSelectedEvidence] = useState(evidence[0]?.id ?? "");
  const [question, setQuestion] = useState("What decision does this verified evidence support today?");
  const [decision, setDecision] = useState("Proceed with the evidence-backed operating response.");
  const [action, setAction] = useState("Create and verify the approved operating follow-up.");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [localApprovals, setLocalApprovals] = useState(approvals);
  const [localJobs, setLocalJobs] = useState(jobs);
  const selected = useMemo(() => evidence.find((item) => item.id === selectedEvidence), [evidence, selectedEvidence]);
  const pending = localApprovals.find((item) => item.status === "pending");
  const approved = localApprovals.find((item) => item.status === "approved");
  const activeJob = localJobs[0];
  const canApprove = role === "owner" || role === "admin";

  async function recordDecision(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await mutate(async () => {
      const { data, error } = await (getSupabaseBrowserClient() as any).rpc("kos_slice_record_decision", {
        target_workspace: workspace.id, evidence_id: selected.id,
        decision_title: `Decision · ${selected.title}`, decision_body: `${question}\n\n${decision}`, requested_action: action
      });
      if (error) throw error;
      const created = data?.[0] as DecisionResult | undefined;
      if (created) setLocalApprovals((items) => [{ id: created.approval_id, subject_id: created.decision_id, action, status: "pending", rationale: null }, ...items]);
      setMessage("Decision recorded with its citation. Approval is now waiting in Inbox.");
      setArea("Inbox");
    });
  }

  async function decideApproval(approve: boolean) {
    if (!pending) return;
    await mutate(async () => {
      const { data, error } = await (getSupabaseBrowserClient() as any).rpc("kos_slice_decide_approval", {
        target_workspace: workspace.id, target_approval: pending.id, approve, rationale_value: approve ? "Approved from the governed Slice 01 review." : "Rejected from the governed Slice 01 review."
      });
      if (error) throw error;
      setLocalApprovals((items) => items.map((item) => item.id === pending.id ? { ...item, ...(data as Partial<Approval>) } : item));
      setMessage(approve ? "Approval granted. The action is eligible to run." : "Approval rejected. The action remains blocked.");
      setArea("Work");
    });
  }

  async function executeAction() {
    if (!approved) return;
    await mutate(async () => {
      const { data, error } = await (getSupabaseBrowserClient() as any).rpc("kos_slice_execute_action", {
        target_workspace: workspace.id, target_approval: approved.id, idempotency_key_value: `slice-01-${approved.id}`
      });
      if (error) throw error;
      const created = data?.[0] as ActionResult | undefined;
      if (created) setLocalJobs((items) => [{ id: created.job_id, resource_id: approved.subject_id, result: { verification_status: "awaiting_evidence" } }, ...items.filter((item) => item.id !== created.job_id)]);
      setMessage(created?.replayed ? "Action was already executed; the original result was reopened." : "Approved action executed once. Add cited evidence to verify the outcome.");
      setArea("Insights");
    });
  }

  async function verifyOutcome() {
    if (!activeJob || !selected) return;
    await mutate(async () => {
      const { data, error } = await (getSupabaseBrowserClient() as any).rpc("kos_slice_verify_outcome", {
        target_workspace: workspace.id, target_job: activeJob.id, evidence_id: selected.id,
        outcome_summary: `Verified against ${selected.title}.`
      });
      if (error) throw error;
      setLocalJobs((items) => items.map((item) => item.id === activeJob.id ? { ...item, result: data.result as Record<string, unknown> } : item));
      setMessage("Outcome verified with cited evidence. The flow is ready for structured handover.");
      setArea("Automations");
    });
  }

  async function mutate(operation: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await operation(); } catch (error) { setMessage(error instanceof Error ? error.message : "The governed transition could not be completed."); }
    finally { setBusy(false); }
  }

  function downloadHandover() {
    const payload = {
      objective: "Complete Production Slice 01 governed operating loop",
      workspace: workspace.slug,
      evidence: selected ? { id: selected.id, title: selected.title, verification_status: selected.verification_status } : null,
      approval: localApprovals[0] ?? null,
      action: activeJob ?? null,
      outcome: activeJob?.result ?? null,
      generated_at: new Date().toISOString()
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `pbs-central-slice-01-handover-${workspace.slug}.json`; link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-lockup app-brand"><span>PBS</span><strong>CENTRAL</strong></div>
        <nav aria-label="Primary workspace">
          {areas.map((name) => <button key={name} className={area === name ? "active" : ""} onClick={() => setArea(name)}><span>{String(areas.indexOf(name) + 1).padStart(2, "0")}</span>{name}</button>)}
        </nav>
        <div className="sidebar-foot"><small>{workspace.name}<br />{role}</small><SignOutButton /></div>
      </aside>
      <section className="app-content">
        <header className="app-header"><div><p className="eyebrow">{area} · Production Slice 01</p><h1>{area === "Home" ? "Morning briefing" : area}</h1></div><div className="flow-meter"><span>Evidence</span><span>Decision</span><span>Approval</span><span>Outcome</span></div></header>
        {message && <div className="app-notice" role="status">{message}</div>}
        {area === "Home" && <section className="briefing-grid">
          <article className="briefing-lead"><p className="eyebrow">Owner briefing</p><h2>One governed decision from evidence to verified outcome.</h2><p>The morning brief turns a cited operating signal into a bounded action. Nothing executes before approval.</p><button onClick={() => setArea("Knowledge")}>Open cited evidence</button></article>
          <FlowLedger approvals={localApprovals} jobs={localJobs} />
        </section>}
        {area === "Knowledge" && <section className="workspace-two-pane">
          <div className="evidence-list"><p className="eyebrow">Verified evidence</p>{evidence.length ? evidence.map((item) => <button key={item.id} className={selectedEvidence === item.id ? "selected" : ""} onClick={() => setSelectedEvidence(item.id)}><strong>{item.title}</strong><span>{item.verification_status}</span></button>) : <EmptyState text="No verified evidence is available yet." />}</div>
          <form className="decision-panel" onSubmit={recordDecision}><p className="eyebrow">Evidence question</p><h2>{selected?.title ?? "Select evidence"}</h2><blockquote>{selected?.body ?? "Choose a verified item to begin."}</blockquote><label>Question<textarea value={question} onChange={(e) => setQuestion(e.target.value)} /></label><label>Recorded decision<textarea value={decision} onChange={(e) => setDecision(e.target.value)} /></label><label>Action requiring approval<input value={action} onChange={(e) => setAction(e.target.value)} /></label><button disabled={busy || !selected}>Record decision and request approval</button></form>
        </section>}
        {area === "Inbox" && <section className="approval-card"><p className="eyebrow">Approval inbox</p>{pending ? <><h2>{pending.action}</h2><p>Requested from a recorded, cited decision. Owner/admin authority is required.</p><div className="button-row"><button disabled={busy || !canApprove} onClick={() => decideApproval(true)}>Approve action</button><button className="secondary" disabled={busy || !canApprove} onClick={() => decideApproval(false)}>Reject</button></div>{!canApprove && <p className="permission-note">Your role can review this request but cannot decide it.</p>}</> : <EmptyState text="No approval is waiting." />}</section>}
        {area === "Work" && <section className="approval-card"><p className="eyebrow">Approved action</p>{approved ? <><h2>{approved.action}</h2><p>The approval gate is satisfied. Execution uses an idempotency key and writes an audit event.</p><button disabled={busy} onClick={executeAction}>Execute approved action</button></> : <EmptyState text="No approved action is ready." />}</section>}
        {area === "Insights" && <section className="approval-card"><p className="eyebrow">Verified outcome</p>{activeJob ? <><h2>{activeJob.result?.verification_status === "verified" ? "Outcome verified" : "Verification required"}</h2><p>{activeJob.result?.verification_status === "verified" ? String(activeJob.result.summary ?? "Verified with cited evidence.") : "Select the cited evidence in Knowledge, then verify the completed action."}</p><button disabled={busy || activeJob.result?.verification_status === "verified" || !selected} onClick={verifyOutcome}>Verify outcome with citation</button></> : <EmptyState text="No executed action is awaiting verification." />}</section>}
        {area === "Automations" && <section className="approval-card"><p className="eyebrow">Structured handover</p><h2>{activeJob?.result?.verification_status === "verified" ? "Flow ready for handover" : "Handover waits for a verified outcome"}</h2><p>The final handover preserves objective, evidence, decision, approval, action, outcome, tests and next action.</p><button disabled={activeJob?.result?.verification_status !== "verified"} onClick={downloadHandover}>Download structured handover</button></section>}
        {(area === "Organization" || area === "Relationships") && <EmptyState text={`${area} is present in the canonical architecture; Slice 01 adds no new ${area.toLowerCase()} module.`} />}
      </section>
    </main>
  );
}

function EmptyState({ text }: { text: string }) { return <div className="empty-state"><p>{text}</p></div>; }
function FlowLedger({ approvals, jobs }: { approvals: Approval[]; jobs: Job[] }) {
  const outcome = jobs[0]?.result?.verification_status;
  return <ol className="flow-ledger"><li className="done">Briefing <span>ready</span></li><li className="done">Evidence <span>cited</span></li><li className={approvals.length ? "done" : ""}>Decision <span>{approvals.length ? "recorded" : "waiting"}</span></li><li className={approvals.some((a) => a.status === "approved") ? "done" : ""}>Approval <span>{approvals[0]?.status ?? "waiting"}</span></li><li className={outcome === "verified" ? "done" : ""}>Outcome <span>{String(outcome ?? "waiting")}</span></li></ol>;
}
