import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function filename(title: string) {
  const stem =
    title
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "knowledge-report";
  return `${stem}.md`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub)
    return NextResponse.redirect(new URL("/", request.url));
  const { data: item } = await supabase
    .from("kos_knowledge_items")
    .select("title,body")
    .eq("id", id)
    .single();
  if (!item)
    return NextResponse.json(
      { error: "Knowledge item not found" },
      { status: 404 },
    );
  const name = filename(item.title);
  return new Response(`# ${item.title}\n\n${item.body}\n`, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
