"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export async function requestDerivative(data: FormData) {
  const supabase = await createSupabaseServerClient();
  const workspaceId = value(data, "workspace_id");
  const documentId = value(data, "document_id");
  const derivativeType = value(data, "derivative_type");
  const targetLanguage = value(data, "target_language") || null;
  const { error } = await supabase.from("kos_document_derivatives").upsert(
    {
      workspace_id: workspaceId,
      document_id: documentId,
      derivative_type: derivativeType,
      target_language: targetLanguage,
      status: "requested",
      content: null,
      error_message: null,
    },
    { onConflict: "document_id,derivative_type,target_language" },
  );
  if (error) redirect(`/workspace/documents?error=${encodeURIComponent(error.code)}`);
  redirect("/workspace/documents?helper=requested");
}

export async function resolveExtractionReview(data: FormData) {
  const supabase = await createSupabaseServerClient();
  const workspaceId = value(data, "workspace_id");
  const reviewId = value(data, "review_id");
  const decision = value(data, "decision");
  const reason = value(data, "reason");
  const rawCorrection = value(data, "correction");
  let correction = null;
  try {
    correction = rawCorrection ? JSON.parse(rawCorrection) : null;
  } catch {
    redirect("/workspace/documents?error=invalid_json");
  }
  const { error } = await (supabase as any).rpc("kos_resolve_extraction_review", {
    target_workspace: workspaceId,
    target_review: reviewId,
    decision_value: decision,
    correction_value: correction,
    reason_value: reason,
  });
  if (error) redirect(`/workspace/documents?error=${encodeURIComponent(error.code)}`);
  redirect("/workspace/documents?review=resolved");
}

export async function createKnowledgeEntry(data: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/");

  const workspaceId = value(data, "workspace_id");
  const title = value(data, "title");
  const body = value(data, "body");
  const kind = value(data, "kind") || "analysis";
  const sourceDocumentId = value(data, "source_document_id");

  if (!title || !body) {
    redirect("/workspace/documents?error=knowledge_title_and_body_required");
  }

  const { data: item, error } = await supabase
    .from("kos_knowledge_items")
    .insert({
      workspace_id: workspaceId,
      kind,
      title,
      body,
      structured_data: {
        created_from: sourceDocumentId ? "document_registry" : "knowledge_base",
      },
      confidence: null,
      verification_status: "unverified",
      sensitivity: "confidential",
      visibility: "workspace",
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !item) {
    redirect(`/workspace/documents?error=${encodeURIComponent(error?.code ?? "knowledge_create_failed")}`);
  }

  if (sourceDocumentId) {
    const { error: sourceError } = await supabase.from("kos_knowledge_sources").insert({
      knowledge_id: item.id,
      workspace_id: workspaceId,
      source_type: "document",
      source_id: sourceDocumentId,
      locator: { relationship: "created_from_registry" },
      quote: "Created from a selected registered source document.",
    });
    if (sourceError) {
      redirect(`/workspace/documents?error=${encodeURIComponent(sourceError.code)}`);
    }
  }

  redirect(`/workspace/knowledge?selected=${item.id}`);
}
