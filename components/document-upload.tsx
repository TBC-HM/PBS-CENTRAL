"use client";

import { DragEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type QueuedFile = { file: File; relativePath: string; status: "ready" | "uploading" | "complete" | "error"; error?: string };
type FileEntry = { isFile: boolean; isDirectory: boolean; name: string; file: (success: (file: File) => void, failure?: (error: unknown) => void) => void };
type DirectoryEntry = { isFile: boolean; isDirectory: boolean; name: string; createReader: () => { readEntries: (success: (entries: Array<FileEntry | DirectoryEntry>) => void, failure?: (error: unknown) => void) => void } };

function safeFilename(name: string) { return name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload"; }
function titleFromPath(path: string) { return path.split("/").pop()?.replace(/\.[^.]+$/, "") || "Untitled upload"; }
function formatBytes(bytes: number) { if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`; if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`; return `${(bytes / 1024).toFixed(1)} KB`; }
async function sha256(file: File) { const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

async function readDirectory(reader: ReturnType<DirectoryEntry["createReader"]>) {
  const all: Array<FileEntry | DirectoryEntry> = [];
  while (true) { const batch = await new Promise<Array<FileEntry | DirectoryEntry>>((resolve, reject) => reader.readEntries(resolve, reject)); if (!batch.length) return all; all.push(...batch); }
}
async function filesFromEntry(entry: FileEntry | DirectoryEntry, parent = ""): Promise<QueuedFile[]> {
  const path = parent ? `${parent}/${entry.name}` : entry.name;
  if (entry.isFile) { const file = await new Promise<File>((resolve, reject) => (entry as FileEntry).file(resolve, reject)); return [{ file, relativePath: path, status: "ready" }]; }
  const children = await readDirectory((entry as DirectoryEntry).createReader());
  return (await Promise.all(children.map((child) => filesFromEntry(child, path)))).flat();
}

export function DocumentUpload({ workspaceId, companyId }: { workspaceId: string; companyId?: string }) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [category, setCategory] = useState("General");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");

  function addFiles(files: File[], paths?: string[]) {
    setQueue((current) => {
      const known = new Set(current.map((item) => `${item.relativePath}:${item.file.size}:${item.file.lastModified}`));
      const additions = files.map((file, index) => ({ file, relativePath: paths?.[index] || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, status: "ready" as const })).filter((item) => !known.has(`${item.relativePath}:${item.file.size}:${item.file.lastModified}`));
      return [...current, ...additions];
    });
  }

  async function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); setMessage("");
    const entries = Array.from(event.dataTransfer.items).map((item) => item.webkitGetAsEntry?.()).filter(Boolean) as unknown as Array<FileEntry | DirectoryEntry>;
    if (entries.length) { const items = (await Promise.all(entries.map((entry) => filesFromEntry(entry)))).flat(); addFiles(items.map((item) => item.file), items.map((item) => item.relativePath)); }
    else addFiles(Array.from(event.dataTransfer.files));
  }

  async function uploadOne(item: QueuedFile) {
    const supabase = getSupabaseBrowserClient();
    const documentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const pathParts = item.relativePath.split("/").map(safeFilename).filter(Boolean);
    const objectPath = `${workspaceId}/${documentId}/${versionId}/${pathParts.join("/")}`;
    const checksum = await sha256(item.file);
    const { error: uploadError } = await supabase.storage.from("knowledge-originals").upload(objectPath, item.file, { contentType: item.file.type || "application/octet-stream", upsert: false });
    if (uploadError) throw uploadError;
    const { error: registerError } = await (supabase as any).rpc("kos_register_uploaded_document", { target_workspace: workspaceId, document_id_value: documentId, version_id_value: versionId, title_value: titleFromPath(item.relativePath), document_type_value: category.trim(), object_path_value: objectPath, original_filename_value: item.relativePath, media_type_value: item.file.type || "application/octet-stream", byte_size_value: item.file.size, sha256_value: checksum });
    if (registerError) { await supabase.storage.from("knowledge-originals").remove([objectPath]); throw registerError; }
    if (companyId) { const { error: linkError } = await (supabase as any).rpc("kos_assign_document_company", { target_workspace: workspaceId, target_document: documentId, target_company: companyId }); if (linkError) throw linkError; }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const pending = queue.filter((item) => item.status === "ready" || item.status === "error");
    if (!pending.length) return;
    setBusy(true); setMessage(`Uploading 0 of ${pending.length} files…`);
    let completed = 0; let failed = 0;
    for (const target of pending) {
      setQueue((items) => items.map((item) => item === target ? { ...item, status: "uploading", error: undefined } : item));
      try { await uploadOne(target); completed += 1; setQueue((items) => items.map((item) => item === target ? { ...item, status: "complete" } : item)); }
      catch (error) { failed += 1; setQueue((items) => items.map((item) => item === target ? { ...item, status: "error", error: error instanceof Error ? error.message : "Upload failed" } : item)); }
      setMessage(`Uploaded ${completed} of ${pending.length}${failed ? ` · ${failed} failed` : ""}.`);
    }
    setBusy(false); router.refresh();
  }

  const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
  return <form className="upload-panel upload-container" onSubmit={submit}><p className="eyebrow">Private document intake{companyId ? " · Company file" : ""}</p><h2>Drop files or entire folders.</h2><p>All file types are accepted. Folder structure is preserved in the registry; every original remains private, tenant-scoped and SHA-256 checksummed.{companyId ? " This batch will be filed directly under the selected company." : ""}</p>
    <div className={`folder-dropzone ${dragging ? "dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={drop}>
      <strong>Pull a folder or any files here</strong><span>Documents, spreadsheets, photos, audio, video, archives and unknown formats</span><div className="button-row"><label className="file-picker"><input type="file" multiple onChange={(event) => addFiles(Array.from(event.target.files ?? []))} />Choose files</label><label className="file-picker"><input ref={(node) => node?.setAttribute("webkitdirectory", "")} type="file" multiple onChange={(event) => addFiles(Array.from(event.target.files ?? []))} />Choose folder</label></div>
    </div>
    <label><span>Category for this batch</span><input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
    {queue.length > 0 && <section className="upload-queue"><header><strong>{queue.length} files</strong><span>{formatBytes(totalBytes)}</span><button type="button" className="quiet-action" disabled={busy} onClick={() => setQueue([])}>Clear</button></header>{queue.map((item, index) => <div key={`${item.relativePath}-${item.file.lastModified}-${index}`}><span><strong>{item.relativePath}</strong><small>{formatBytes(item.file.size)} · {item.file.type || "Unknown file type"}{item.error ? ` · ${item.error}` : ""}</small></span><em className={item.status}>{item.status}</em></div>)}</section>}
    <button disabled={busy || !queue.some((item) => item.status === "ready" || item.status === "error")}>{busy ? "Uploading batch…" : `Upload and register ${queue.filter((item) => item.status !== "complete").length || ""} files`}</button><p className="form-message" role="status">{message}</p>
  </form>;
}
