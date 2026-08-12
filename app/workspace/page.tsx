import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function WorkspacePage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) redirect("/");

  const { data: workspaces, error } = await supabase.from("kos_workspaces").select("id, slug, name").order("name");

  if (error) {
    return <WorkspaceState eyebrow="Access check failed" title="Workspace unavailable." description="We could not verify your PBS Central membership. No workspace data was opened." />;
  }

  if (!workspaces?.length) {
    return <WorkspaceState eyebrow="Authenticated · no membership" title="Access has not been granted." description="Your identity is valid, but you are not an active member of a PBS Central workspace." />;
  }

  return (
    <main className="workspace-state">
      <p className="eyebrow">Workspace verified</p>
      <h1>{workspaces[0].name}</h1>
      <p>The governed workspace boundary is active. The Phase 0 shell is being restored incrementally.</p>
      <div className="workspace-meta"><span>Tenant</span><strong>{workspaces[0].slug}</strong></div>
      <SignOutButton />
    </main>
  );
}

function WorkspaceState({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <main className="workspace-state"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p><SignOutButton /></main>;
}
