"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function safeFilename(name: string) { return name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload"; }
async function sha256(file: File) { const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export function DocumentUpload({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim()) return;
    setBusy(true); setMessage("Calculating checksum…");
    const supabase = getSupabaseBrowserClient();
    const documentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const objectPath = `${workspaceId}/${documentId}/${versionId}/${safeFilename(file.name)}`;
    try {
      const checksum = await sha256(file);
      setMessage("Uploading encrypted private original…");
      const { error: uploadError } = await supabase.storage.from("knowledge-originals").upload(objectPath, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;
      const { error: registerError } = await (supabase as any).rpc("kos_register_uploaded_document", { target_workspace: workspaceId, document_id_value: documentId, version_id_value: versionId, title_value: title.trim(), document_type_value: category.trim(), object_path_value: objectPath, original_filename_value: file.name, media_type_value: file.type || "application/octet-stream", byte_size_value: file.size, sha256_value: checksum });
      if (registerError) { await supabase.storage.from("knowledge-originals").remove([objectPath]); throw registerError; }
      setMessage("Uploaded, checksummed and registered. Processing is queued.");
      setFile(null); setTitle(""); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload could not be completed."); }
    finally { setBusy(false); }
  }

  return <form className="upload-panel" onSubmit={submit}><p className="eyebrow">Private document intake</p><h2>Upload any file</h2><p>Documents, spreadsheets, PDFs, photos, audio, video and archives up to 500 MB. The original is private, tenant-scoped and SHA-256 checksummed.</p><label><span>File</span><input type="file" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, "")); }} /></label><label><span>Document title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label><span>Category</span><input value={category} onChange={(event) => setCategory(event.target.value)} /></label>{file && <div className="upload-file"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || "Unknown type"}</span></div>}<button disabled={busy || !file || !title.trim()}>{busy ? "Working…" : "Upload and register"}</button><p className="form-message" role="status">{message}</p></form>;
}
