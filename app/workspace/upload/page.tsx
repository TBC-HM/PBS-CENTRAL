import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentUpload } from "@/components/document-upload";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function UploadPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/");
  const { data: workspaces } = await supabase.from("kos_workspaces").select("id,name").order("name").limit(1);
  if (!workspaces?.length) redirect("/workspace");
  return <main className="entity-page"><nav><Link href="/workspace">← Workspace</Link></nav><header><p className="eyebrow">Knowledge · Intake</p><h1>Document upload</h1><p>Register new source material in {workspaces[0].name}.</p></header><DocumentUpload workspaceId={workspaces[0].id} /></main>;
}
