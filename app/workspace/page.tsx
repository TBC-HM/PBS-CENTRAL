import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function WorkspacePage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/");

  const { data: workspaces, error } = await supabase.from("kos_workspaces").select("id,slug,name").order("name").limit(1);
  if (error || !workspaces?.length) redirect("/");
  const workspace = workspaces[0];
  const [membership, evidence, approvals, jobs, documents, sessions, handovers, sources] = await Promise.all([
    supabase.from("kos_workspace_members").select("role").eq("workspace_id", workspace.id).eq("user_id", claims.claims.sub).single(),
    supabase.from("kos_knowledge_items").select("id,title,body,verification_status").eq("workspace_id", workspace.id).in("verification_status", ["verified", "reviewed"]).order("updated_at", { ascending: false }).limit(12),
    supabase.from("kos_approvals").select("id,subject_id,action,status,rationale").eq("workspace_id", workspace.id).eq("subject_type", "knowledge_decision").order("created_at", { ascending: false }).limit(12),
    supabase.from("kos_processing_jobs").select("id,resource_id,result").eq("workspace_id", workspace.id).eq("job_type", "slice_01_approved_action").order("created_at", { ascending: false }).limit(5),
    supabase.from("kos_documents").select("id,title,document_type,status,updated_at").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(60),
    supabase.from("kos_agent_sessions").select("id,resume_key,objective,status,current_phase,updated_at").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(20),
    supabase.from("kos_agent_handovers").select("id,session_id,sequence,summary,completed,risks,next_actions,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("kos_knowledge_sources").select("knowledge_id,source_type,source_id,locator,quote").eq("workspace_id", workspace.id).limit(100)
  ]);

  return <WorkspaceShell workspace={workspace} role={String(membership.data?.role ?? "viewer")} evidence={evidence.data ?? []} approvals={approvals.data ?? []} jobs={jobs.data ?? []} documents={documents.data ?? []} sessions={sessions.data ?? []} handovers={handovers.data ?? []} sources={sources.data ?? []} />;
}
