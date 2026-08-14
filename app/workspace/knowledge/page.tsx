import Link from "next/link";
import { MarkdownReport } from "@/components/markdown-report";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { recordRelation, resolveContradiction, supersedeKnowledge } from "./actions";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string; selected?: string }> }) {
  const p = await searchParams;
  const s = await createSupabaseServerClient();
  const { data: c } = await s.auth.getClaims();
  if (!c?.claims?.sub) redirect("/");
  const { data: w } = await s.from("kos_workspaces").select("id").limit(1).single();
  if (!w) redirect("/workspace");
  const [{ data: membership }, { data: results, error }, { data: relations }] = await Promise.all([
    s.from("kos_workspace_members").select("role").eq("workspace_id", w.id).eq("user_id", c.claims.sub).single(),
    (s as any).rpc("kos_search_knowledge", { target_workspace: w.id, query_text: p.q ?? "", result_limit: 60 }),
    s.from("kos_knowledge_relations").select("id,source_knowledge_id,target_knowledge_id,relation_type,status,reason,resolution,created_at").eq("workspace_id", w.id).order("created_at", { ascending: false }),
  ]);
  if (error) throw error;
  const items = (results ?? []) as any[];
  const selected = items.find((x) => x.id === p.selected) ?? items[0];
  const canResolve = ["owner", "admin"].includes(String(membership?.role));
  return <main className="entity-page">
    <nav><Link href="/workspace">← Workspace</Link><Link href="/workspace/documents">Documents</Link></nav>
    <header><p className="eyebrow">Knowledge · Governed retrieval</p><h1>Knowledge review</h1><p>Search permitted workspace knowledge, inspect its evidence and contradictions, and create append-only corrections.</p></header>
    <form className="knowledge-query"><label><span>Search this workspace</span><input name="q" defaultValue={p.q ?? ""} placeholder="Company, decision, policy or evidence" /></label><button>Search knowledge</button></form>
    <section className="workspace-two-pane"><div className="record-list">{items.map((x) => <Link key={x.id} className={selected?.id === x.id ? "selected" : ""} href={`/workspace/knowledge?q=${encodeURIComponent(p.q ?? "")}&selected=${x.id}`}><span><strong>{x.title}</strong><small>{x.kind} · {x.verification_status} · {x.source_count} sources</small></span><em>{x.open_contradictions ? `${x.open_contradictions} open conflict` : "clear"}</em></Link>)}</div>
      <article className="record-detail">{selected ? <><p className="eyebrow">{selected.verification_status} · {selected.sensitivity} · confidence {selected.confidence}</p><h2>{selected.title}</h2><MarkdownReport content={selected.body} /><dl><div><dt>Sources</dt><dd>{selected.source_count}</dd></div><div><dt>Open contradictions</dt><dd>{selected.open_contradictions}</dd></div><div><dt>Freshness</dt><dd>{new Date(selected.updated_at).toLocaleDateString()}</dd></div></dl><details><summary>View citations</summary><div className="settings-ledger">{selected.citations?.length?selected.citations.map((citation:any,index:number)=><article key={`${citation.source_id}-${index}`}><div><strong>{citation.source_type}</strong><span>{citation.quote||'Linked evidence without excerpt'}</span></div><em>{citation.locator?.path||citation.locator?.url||citation.source_id}</em></article>):<p>No citations attached. Treat this item as unsupported until evidence is linked.</p>}</div></details>
        <details><summary>Record contradiction or support</summary><form action={recordRelation} className="goal-interview"><input type="hidden" name="workspace_id" value={w.id} /><input type="hidden" name="source_id" value={selected.id} /><label>Related knowledge<select name="target_id" required><option value="">Choose item</option>{items.filter((x) => x.id !== selected.id).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label><label>Relationship<select name="relation"><option value="contradicts">Contradicts</option><option value="supports">Supports</option></select></label><label>Evidence-based reason<textarea name="reason" required /></label><button>Record governed relationship</button></form></details>
        {canResolve && <details><summary>Create superseding revision</summary><form action={supersedeKnowledge} className="goal-interview"><input type="hidden" name="workspace_id" value={w.id} /><input type="hidden" name="prior_id" value={selected.id} /><label>Replacement title<input name="title" defaultValue={selected.title} required /></label><label>Replacement knowledge<textarea name="body" defaultValue={selected.body} required /></label><label>Reason and evidence<textarea name="reason" required /></label><button>Create candidate revision</button></form></details>}</> : <p>No permitted knowledge matches this query.</p>}</article>
    </section>
    <section className="relationship-board"><div><p className="eyebrow">Contradiction and supersession ledger</p><strong>{relations?.length ?? 0} governed relationships</strong></div>{relations?.map((r: any) => <article key={r.id}><span>{r.relation_type} · {r.status}</span><p>{r.reason}</p>{r.resolution && <small>{r.resolution}</small>}{canResolve && r.relation_type === "contradicts" && r.status === "open" && <details><summary>Resolve contradiction</summary><form action={resolveContradiction} className="goal-interview"><input type="hidden" name="workspace_id" value={w.id} /><input type="hidden" name="relation_id" value={r.id} /><label>Resolution<select name="resolution_action"><option value="source_preferred">Prefer source</option><option value="target_preferred">Prefer target</option><option value="contextual">Both valid in different contexts</option><option value="dismissed">Dismiss unsupported conflict</option></select></label><label>Resolution reason and evidence<textarea name="resolution_reason" required /></label><button>Resolve and audit</button></form></details>}</article>)}</section>
  </main>;
}
