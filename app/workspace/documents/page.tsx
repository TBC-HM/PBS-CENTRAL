import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentLibrary } from "@/components/document-library";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  createKnowledgeEntry,
  resolveExtractionReview,
} from "./actions";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/");

  const { data: workspaces } = await supabase
    .from("kos_workspaces")
    .select("id,name")
    .limit(1);
  if (!workspaces?.length) redirect("/workspace");
  const workspace = workspaces[0];

  const [
    { data: companies },
    { data: documents },
    { data: links },
    { data: helpers },
    { data: reviews },
    { data: knowledge },
  ] = await Promise.all([
    supabase
      .from("kos_companies")
      .select("id,name")
      .eq("workspace_id", workspace.id)
      .order("name"),
    supabase
      .from("kos_documents")
      .select(
        "id,title,document_type,status,updated_at,versions:kos_document_versions(original_filename,extraction_status,version_number)",
      )
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("kos_document_links")
      .select("document_id,resource_id")
      .eq("workspace_id", workspace.id)
      .eq("resource_type", "company"),
    supabase
      .from("kos_document_derivatives")
      .select("id,document_id,derivative_type,target_language,status,content")
      .eq("workspace_id", workspace.id),
    supabase
      .from("kos_extraction_reviews")
      .select(
        "id,document_id,field_path,predicted_value,confidence,risk_class,threshold,status",
      )
      .eq("workspace_id", workspace.id)
      .eq("status", "pending")
      .order("risk_class")
      .order("confidence"),
    supabase
      .from("kos_knowledge_items")
      .select("id,title,kind,verification_status,updated_at")
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const companyMap = new Map(
    (links ?? []).map((link) => [link.document_id, link.resource_id]),
  );
  const normalizedDocuments = (documents ?? []).map((document) => ({
    ...document,
    version:
      [...(document.versions ?? [])].sort(
        (a, b) => b.version_number - a.version_number,
      )[0] ?? null,
    company_id: companyMap.get(document.id) ?? null,
    helpers: (helpers ?? []).filter(
      (helper) => helper.document_id === document.id,
    ),
  }));

  return (
    <main className="entity-page">
      <nav>
        <Link href="/workspace">← Workspace</Link>
        <Link href="/workspace/knowledge">Knowledge review</Link>
      </nav>

      <header>
        <p className="eyebrow">Knowledge · Source and meaning</p>
        <h1>Documents</h1>
        <p>
          Keep original evidence in the Registry. Turn reviewed material into
          searchable knowledge without losing the source trail.
        </p>
      </header>

      {params.error && (
        <p className="container-error" role="alert">
          The entry was not saved: {params.error.replaceAll("_", " ")}.
        </p>
      )}

      <section className="knowledge-containers" aria-label="Document containers">
        <article className="knowledge-container registry-container">
          <div className="container-index" aria-hidden>
            R
          </div>
          <div className="container-copy">
            <p className="eyebrow">Container 1 · Evidence</p>
            <h2>Document Registry</h2>
            <p>
              Original files, immutable versions, company filing, previews and
              extraction review.
            </p>
            <dl>
              <div>
                <dt>Registered</dt>
                <dd>{normalizedDocuments.length}</dd>
              </div>
              <div>
                <dt>Awaiting review</dt>
                <dd>{reviews?.length ?? 0}</dd>
              </div>
            </dl>
          </div>
          <div className="container-actions">
            <Link className="container-primary" href="/workspace/upload">
              Upload files or folders
            </Link>
            <a className="container-secondary" href="#document-registry">
              Browse Registry
            </a>
          </div>
        </article>

        <article className="knowledge-container base-container">
          <div className="container-index" aria-hidden>
            K
          </div>
          <div className="container-copy">
            <p className="eyebrow">Container 2 · Meaning</p>
            <h2>Knowledge Base</h2>
            <p>
              Reports, analyses, plans and decisions. New entries remain
              unverified until a human reviews them.
            </p>
            <dl>
              <div>
                <dt>Recent entries shown</dt>
                <dd>{knowledge?.length ?? 0}</dd>
              </div>
              <div>
                <dt>Default status</dt>
                <dd>Unverified</dd>
              </div>
            </dl>
          </div>
          <div className="container-actions">
            <details className="knowledge-create">
              <summary className="container-primary">Create knowledge entry</summary>
              <form action={createKnowledgeEntry}>
                <input
                  type="hidden"
                  name="workspace_id"
                  value={workspace.id}
                />
                <label>
                  Entry type
                  <select name="kind" defaultValue="analysis">
                    <option value="analysis">Report or analysis</option>
                    <option value="plan">Plan</option>
                    <option value="decision">Decision</option>
                    <option value="proposed_fact">Proposed fact</option>
                  </select>
                </label>
                <label>
                  Title
                  <input
                    name="title"
                    placeholder="Clear human-readable title"
                    required
                  />
                </label>
                <label>
                  Content
                  <textarea
                    name="body"
                    placeholder="Write or paste Markdown here"
                    required
                  />
                </label>
                <label>
                  Source document (optional)
                  <select name="source_document_id" defaultValue="">
                    <option value="">No Registry source</option>
                    {normalizedDocuments.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Source-linked entries preserve the Registry document as
                  evidence. Creation never marks knowledge as verified.
                </p>
                <button>Create unverified knowledge</button>
              </form>
            </details>
            <Link
              className="container-secondary"
              href="/workspace/knowledge"
            >
              Browse Knowledge Base
            </Link>
          </div>
        </article>
      </section>

      <section className="knowledge-recent">
        <div>
          <p className="eyebrow">Recently updated knowledge</p>
          <strong>{knowledge?.length ?? 0} latest entries</strong>
        </div>
        <div>
          {knowledge?.map((item) => (
            <Link
              key={item.id}
              href={`/workspace/knowledge?selected=${item.id}`}
            >
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.kind.replaceAll("_", " ")} ·{" "}
                  {item.verification_status}
                </small>
              </span>
              <em>Open →</em>
            </Link>
          ))}
        </div>
      </section>

      <section className="settings-panel">
        <div>
          <p className="eyebrow">Human review queue</p>
          <h2>{reviews?.length ?? 0} extracted fields need review</h2>
          <p>
            Legal, financial and restricted fields always require approval.
            Standard and identity fields are queued below their confidence
            threshold.
          </p>
        </div>
        <div className="settings-ledger">
          {reviews?.length ? (
            reviews.map((review: any) => (
              <article key={review.id}>
                <div>
                  <strong>
                    {review.risk_class} · {review.field_path}
                  </strong>
                  <span>
                    Confidence {review.confidence} · threshold {review.threshold}
                  </span>
                  <pre className="markdown-preview">
                    {JSON.stringify(review.predicted_value, null, 2)}
                  </pre>
                  <form
                    action={resolveExtractionReview}
                    className="goal-interview"
                  >
                    <input
                      type="hidden"
                      name="workspace_id"
                      value={workspace.id}
                    />
                    <input type="hidden" name="review_id" value={review.id} />
                    <label>
                      Decision
                      <select name="decision">
                        <option value="approved">Approve</option>
                        <option value="corrected">Correct</option>
                        <option value="rejected">Reject</option>
                      </select>
                    </label>
                    <label>
                      Corrected JSON
                      <textarea
                        name="correction"
                        placeholder='{"value":"correct value"}'
                      />
                    </label>
                    <label>
                      Review reason
                      <input name="reason" required />
                    </label>
                    <button>Save audited review</button>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <p>No extracted fields are waiting for review.</p>
          )}
        </div>
      </section>

      <div id="document-registry">
        <DocumentLibrary
          workspaceId={workspace.id}
          companies={companies ?? []}
          initialDocuments={normalizedDocuments}
        />
      </div>
    </main>
  );
}
