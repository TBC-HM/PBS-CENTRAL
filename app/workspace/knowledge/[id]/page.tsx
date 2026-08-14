import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MarkdownReport } from "@/components/markdown-report";
import { DocumentActions } from "@/components/document-actions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function KnowledgePreview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/");
  const { data: item } = await supabase
    .from("kos_knowledge_items")
    .select(
      "id,title,body,kind,verification_status,sensitivity,confidence,updated_at",
    )
    .eq("id", id)
    .single();
  if (!item) notFound();
  return (
    <main className="entity-page knowledge-report-preview">
      <nav>
        <Link href={`/workspace/knowledge?selected=${item.id}`}>
          ← Knowledge review
        </Link>
        <Link href="/workspace/documents">Documents</Link>
      </nav>
      <header>
        <p className="eyebrow">
          {item.kind.replaceAll("_", " ")} · {item.verification_status} ·{" "}
          {item.sensitivity}
        </p>
        <h1>{item.title}</h1>
        <p>
          Updated {new Date(item.updated_at).toLocaleDateString()} · Confidence{" "}
          {item.confidence}
        </p>
        <DocumentActions kind="knowledge" id={item.id} />
      </header>
      <article className="record-detail">
        <MarkdownReport content={item.body} />
      </article>
    </main>
  );
}
