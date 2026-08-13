import { redirect } from "next/navigation";
import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace-shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function WorkspacePage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/");

  const { data: workspaces, error } = await supabase.from("kos_workspaces").select("id,slug,name").order("name").limit(1);
  if (error || !workspaces?.length) redirect("/");
  const workspace = workspaces[0];
  const [membership, evidence, approvals, jobs, documents, sessions, handovers, sources, companies, contacts, aliases, companyRelationships] = await Promise.all([
    supabase.from("kos_workspace_members").select("role").eq("workspace_id", workspace.id).eq("user_id", claims.claims.sub).single(),
    supabase.from("kos_knowledge_items").select("id,title,body,verification_status").eq("workspace_id", workspace.id).in("verification_status", ["verified", "reviewed"]).order("updated_at", { ascending: false }).limit(12),
    supabase.from("kos_approvals").select("id,subject_id,action,status,rationale").eq("workspace_id", workspace.id).eq("subject_type", "knowledge_decision").order("created_at", { ascending: false }).limit(12),
    supabase.from("kos_processing_jobs").select("id,resource_id,result").eq("workspace_id", workspace.id).eq("job_type", "slice_01_approved_action").order("created_at", { ascending: false }).limit(5),
    supabase.from("kos_documents").select("id,title,document_type,status,updated_at").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(60),
    supabase.from("kos_agent_sessions").select("id,resume_key,objective,status,current_phase,updated_at").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }).limit(20),
    supabase.from("kos_agent_handovers").select("id,session_id,sequence,summary,completed,risks,next_actions,created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("kos_knowledge_sources").select("knowledge_id,source_type,source_id,locator,quote").eq("workspace_id", workspace.id).limit(100),
    supabase.from("kos_companies").select("id,name,legal_name,jurisdiction,registration_number,status,source_code,company_type,website,updated_at").eq("workspace_id", workspace.id).order("name").limit(100),
    supabase.from("kos_contacts").select("id,company_id,source_code,name,email,phone,role_title,contact_type,company_name,status,metadata,updated_at").eq("workspace_id", workspace.id).order("name").limit(1200),
    supabase.from("kos_company_aliases").select("id,company_id,alias").eq("workspace_id", workspace.id).limit(200),
    supabase.from("kos_company_relationships").select("id,source_company_id,target_company_id,relationship_type,external_party,ownership_percent,valid_from,valid_to").eq("workspace_id", workspace.id).limit(200)
  ]);

  return <><div className="workspace-shortcuts"><Link href="/workspace/upload">＋ Upload files</Link><Link href="/workspace/automations">Run automations</Link>{companies.data?.[0] && <Link href={`/workspace/companies/${companies.data[0].id}`}>Open company dossier</Link>}</div><WorkspaceShell workspace={workspace} role={String(membership.data?.role ?? "viewer")} evidence={evidence.data ?? []} approvals={approvals.data ?? []} jobs={jobs.data ?? []} documents={documents.data ?? []} sessions={sessions.data ?? []} handovers={handovers.data ?? []} sources={sources.data ?? []} companies={companies.data ?? []} contacts={contacts.data ?? []} aliases={aliases.data ?? []} companyRelationships={companyRelationships.data ?? []} /></>;
}
