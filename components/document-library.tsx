"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestDerivative } from "@/app/workspace/documents/actions";
import { DocumentActions } from "@/components/document-actions";
type Company = { id: string; name: string };
type Helper = {
  id: string;
  derivative_type: string;
  target_language: string | null;
  status: string;
  content: string | null;
};
type Doc = {
  id: string;
  title: string;
  document_type: string | null;
  status: string;
  updated_at: string;
  version?: { original_filename: string; extraction_status: string } | null;
  company_id?: string | null;
  helpers?: Helper[];
};
export function DocumentLibrary({
  workspaceId,
  companies,
  initialDocuments,
}: {
  workspaceId: string;
  companies: Company[];
  initialDocuments: Doc[];
}) {
  const [documents, setDocuments] = useState(initialDocuments),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const filtered = useMemo(
    () =>
      documents.filter(
        (doc) =>
          !search.trim() ||
          `${doc.title} ${doc.version?.original_filename ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [documents, search],
  );
  async function assign(documentId: string, companyId: string) {
    if (!companyId) return;
    setBusy(documentId);
    const { error } = await (getSupabaseBrowserClient() as any).rpc(
      "kos_assign_document_company",
      {
        target_workspace: workspaceId,
        target_document: documentId,
        target_company: companyId,
      },
    );
    if (error) setMessage(error.message);
    else {
      setDocuments((items) =>
        items.map((item) =>
          item.id === documentId ? { ...item, company_id: companyId } : item,
        ),
      );
      setMessage("Document filed under the selected company.");
    }
    setBusy("");
  }
  return (
    <section className="document-library">
      <header className="directory-toolbar">
        <div>
          <p className="eyebrow">Company document tree</p>
          <strong>{documents.length} registered documents</strong>
        </div>
        <label>
          <span>Find a file</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title or filename"
          />
        </label>
      </header>
      <div className="document-tree">
        {[{ id: "unassigned", name: "Unassigned uploads" }, ...companies].map(
          (branch) => {
            const files = filtered.filter((doc) =>
              branch.id === "unassigned"
                ? !doc.company_id
                : doc.company_id === branch.id,
            );
            if (!files.length && branch.id !== "unassigned") return null;
            return (
              <details key={branch.id} open>
                <summary>
                  <span>{branch.name}</span>
                  <em>{files.length} files</em>
                </summary>
                <div className="document-category-tree">
                  {Object.entries(
                    Object.groupBy(
                      files,
                      (doc) => doc.document_type || "Uncategorized",
                    ),
                  ).map(([category, items]) => (
                    <details key={category} open>
                      <summary>
                        <span>{category}</span>
                        <em>{items?.length ?? 0}</em>
                      </summary>
                      {items?.map((doc) => {
                        const summary = doc.helpers?.find(
                          (x) => x.derivative_type === "summary",
                        );
                        return (
                          <article className="document-row" key={doc.id}>
                            <div>
                              <strong>{doc.title}</strong>
                              <small>
                                {doc.version?.original_filename ??
                                  "Registry document"}{" "}
                                · {doc.version?.extraction_status ?? doc.status}
                              </small>
                              {summary && (
                                <small>
                                  Summary: {summary.status}
                                  {summary.content
                                    ? ` · ${summary.content}`
                                    : ""}
                                </small>
                              )}
                            </div>
                            <div className="document-actions">
                              <DocumentActions
                                kind="registry"
                                id={doc.id}
                                className="document-file-actions"
                              />
                              <form action={requestDerivative}>
                                <input
                                  type="hidden"
                                  name="workspace_id"
                                  value={workspaceId}
                                />
                                <input
                                  type="hidden"
                                  name="document_id"
                                  value={doc.id}
                                />
                                <input
                                  type="hidden"
                                  name="derivative_type"
                                  value="summary"
                                />
                                <button>Summarize</button>
                              </form>
                              <form action={requestDerivative}>
                                <input
                                  type="hidden"
                                  name="workspace_id"
                                  value={workspaceId}
                                />
                                <input
                                  type="hidden"
                                  name="document_id"
                                  value={doc.id}
                                />
                                <input
                                  type="hidden"
                                  name="derivative_type"
                                  value="translation"
                                />
                                <select
                                  name="target_language"
                                  defaultValue="en"
                                >
                                  <option value="en">English</option>
                                  <option value="de">German</option>
                                  <option value="es">Spanish</option>
                                  <option value="fr">French</option>
                                  <option value="it">Italian</option>
                                  <option value="pl">Polish</option>
                                </select>
                                <button>Translate</button>
                              </form>
                              {!doc.company_id ? (
                                <select
                                  disabled={busy === doc.id}
                                  defaultValue=""
                                  onChange={(e) =>
                                    assign(doc.id, e.target.value)
                                  }
                                >
                                  <option value="">Assign to company…</option>
                                  {companies.map((company) => (
                                    <option key={company.id} value={company.id}>
                                      {company.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Link
                                  href={`/workspace/companies/${doc.company_id}`}
                                >
                                  Open company
                                </Link>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </details>
                  ))}
                </div>
              </details>
            );
          },
        )}
      </div>
      <p className="form-message" role="status">
        {message}
      </p>
    </section>
  );
}
