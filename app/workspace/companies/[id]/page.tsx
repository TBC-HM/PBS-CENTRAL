import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/");
  const { data: company } = await supabase.from("kos_companies").select("id,workspace_id,name,legal_name,jurisdiction,registration_number,status,company_type,website,updated_at").eq("id", id).single();
  if (!company) notFound();
  const [{ data: contacts }, { data: aliases }, { data: documents }] = await Promise.all([
    supabase.from("kos_contacts").select("id,name,email,phone,role_title,status").eq("workspace_id", company.workspace_id).eq("company_id", company.id).order("name"),
    supabase.from("kos_company_aliases").select("alias").eq("workspace_id", company.workspace_id).eq("company_id", company.id),
    supabase.from("kos_documents").select("id,title,document_type,status,updated_at").eq("workspace_id", company.workspace_id).ilike("title", `%${company.name.replaceAll(",", "")}%`).order("updated_at", { ascending: false }).limit(20)
  ]);
  return <main className="entity-page"><nav><Link href="/workspace">← Workspace</Link><Link href="/workspace#organization">Company directory</Link></nav><header><p className="eyebrow">Company · {company.status}</p><h1>{company.name}</h1><p>{company.legal_name && company.legal_name !== company.name ? company.legal_name : company.company_type ?? "Company"}</p></header><section className="entity-page-grid"><article><h2>Company record</h2><dl><div><dt>Jurisdiction</dt><dd>{company.jurisdiction ?? "Not recorded"}</dd></div><div><dt>Registration</dt><dd>{company.registration_number ?? "Not recorded"}</dd></div><div><dt>Aliases</dt><dd>{aliases?.map((item) => item.alias).join(", ") || "None"}</dd></div><div><dt>Website</dt><dd>{company.website ? <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer">{company.website}</a> : "Not recorded"}</dd></div><div><dt>Last updated</dt><dd>{new Date(company.updated_at).toLocaleDateString()}</dd></div></dl></article><article><h2>People <span>{contacts?.length ?? 0}</span></h2><div className="entity-page-list">{contacts?.length ? contacts.map((contact) => <Link key={contact.id} href={`/workspace/contacts/${contact.id}`}><strong>{contact.name}</strong><span>{contact.role_title ?? contact.email ?? "Contact"}</span></Link>) : <p>No linked contacts.</p>}</div></article><article className="entity-page-wide"><h2>Related documents <span>{documents?.length ?? 0}</span></h2><div className="entity-page-list">{documents?.length ? documents.map((document) => <div key={document.id}><strong>{document.title}</strong><span>{document.document_type ?? "Uncategorized"} · {document.status}</span></div>) : <p>No governed document is linked to this company yet.</p>}</div></article></section></main>;
}
