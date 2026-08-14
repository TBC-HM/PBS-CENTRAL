import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function disposition(filename: string, download: boolean) {
  const safe = filename.replace(/[\r\n"]/g, "_").replace(/[^\x20-\x7e]/g, "_");
  return `${download ? "attachment" : "inline"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
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
  const { data: version } = await supabase
    .from("kos_document_versions")
    .select("bucket_id,object_path,original_filename,media_type")
    .eq("document_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  if (!version)
    return NextResponse.json(
      { error: "Document version not found" },
      { status: 404 },
    );
  const { data: file, error } = await supabase.storage
    .from(version.bucket_id)
    .download(version.object_path);
  if (error || !file)
    return NextResponse.json(
      { error: "Document file unavailable" },
      { status: 404 },
    );
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(file, {
    headers: {
      "Content-Type":
        version.media_type || file.type || "application/octet-stream",
      "Content-Disposition": disposition(
        version.original_filename || "document",
        download,
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
