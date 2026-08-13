import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/");
  const { data: contact } = await supabase.from("kos_contacts").select("id,workspace_id,company_id,name,email,phone,role_title,contact_type,company_name,status,source_code,metadata,updated_at").eq("id", id).single();
  if (!contact) notFound();
  const { data: company } = contact.company_id ? await supabase.from("kos_companies").select("id,name,legal_name").eq("workspace_id", contact.workspace_id).eq("id", contact.company_id).maybeSingle() : { data: null };
  const metadata = (contact.metadata ?? {}) as Record<string, unknown>;
  const whatsapp = String(metadata.whatsapp ?? "").replace(/\D/g, "");
  return <main className="entity-page"><nav><Link href="/workspace">← Workspace</Link><Link href="/workspace#relationships">Contact directory</Link></nav><header><p className="eyebrow">Contact · {contact.status}</p><h1>{contact.name}</h1><p>{contact.role_title ?? contact.contact_type}</p><div className="contact-actions">{contact.email && <a href={`mailto:${contact.email}`}>Send email</a>}{contact.phone && <a href={`tel:${contact.phone}`}>Call</a>}{whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>}</div></header><section className="entity-page-grid"><article><h2>Contact record</h2><dl><div><dt>Email</dt><dd>{contact.email ?? "Not recorded"}</dd></div><div><dt>Phone</dt><dd>{contact.phone ?? "Not recorded"}</dd></div><div><dt>Company</dt><dd>{company?.name ?? contact.company_name ?? "Not linked"}</dd></div><div><dt>Source</dt><dd>{contact.source_code ?? String(metadata.source_id ?? "Not recorded")}</dd></div><div><dt>Tags</dt><dd>{String(metadata.tags ?? "None")}</dd></div><div><dt>Address</dt><dd>{String(metadata.postal_address ?? metadata.city_country ?? "Not recorded")}</dd></div><div><dt>Last updated</dt><dd>{new Date(contact.updated_at).toLocaleDateString()}</dd></div></dl>{company && <Link className="entity-link" href={`/workspace/companies/${company.id}`}>Open permanent company page</Link>}</article></section></main>;
}
