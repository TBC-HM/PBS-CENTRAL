insert into public.kos_workflow_definitions (workspace_id, slug, name, definition, version, status)
select
  workspace.id,
  template.slug,
  template.name,
  template.definition,
  1,
  'active'
from public.kos_workspaces as workspace
cross join (
  values
    ('morning-briefing', 'Morning briefing', '{"category":"Briefing","summary":"Compile cited operating signals into the owner morning briefing.","trigger":"scheduled_or_manual","schedule":"Daily","requires_approval":false,"steps":[{"type":"collect_verified_knowledge"},{"type":"compose_cited_briefing"},{"type":"publish_to_inbox"}]}'::jsonb),
    ('document-intake-and-classification', 'Document intake & classification', '{"category":"Documents","summary":"Register uploaded files, classify them and route uncertain items for review.","trigger":"file_uploaded_or_manual","schedule":"On upload","requires_approval":false,"steps":[{"type":"register_document"},{"type":"classify_document"},{"type":"route_review"}]}'::jsonb),
    ('company-registry-monitoring', 'Company registry monitoring', '{"category":"Companies","summary":"Check governed registry sources for company changes and announcements.","trigger":"scheduled_or_manual","schedule":"Weekly","requires_approval":true,"steps":[{"type":"select_company"},{"type":"research_registry"},{"type":"compare_company_record"},{"type":"request_change_approval"}]}'::jsonb),
    ('company-relationship-research', 'Company relationship research', '{"category":"Research","summary":"Research ownership, advisers, banks and related parties with cited evidence.","trigger":"manual","schedule":"On demand","requires_approval":true,"steps":[{"type":"select_company"},{"type":"research_relationships"},{"type":"attach_citations"},{"type":"request_record_approval"}]}'::jsonb),
    ('compliance-obligation-review', 'Compliance obligation review', '{"category":"Compliance","summary":"Review upcoming company obligations and prepare owner-approved tasks.","trigger":"scheduled_or_manual","schedule":"Monthly","requires_approval":true,"steps":[{"type":"collect_obligations"},{"type":"identify_due_items"},{"type":"prepare_tasks"},{"type":"request_action_approval"}]}'::jsonb),
    ('knowledge-integrity-review', 'Knowledge integrity review', '{"category":"Knowledge","summary":"Detect stale, contradictory or unsupported operating knowledge.","trigger":"scheduled_or_manual","schedule":"Daily","requires_approval":true,"steps":[{"type":"collect_authoritative_sources"},{"type":"detect_drift"},{"type":"classify_risk"},{"type":"request_repair_approval"}]}'::jsonb)
) as template(slug, name, definition)
where workspace.slug = 'pbs-central'
on conflict (workspace_id, slug, version) do update
set name = excluded.name,
    definition = excluded.definition,
    status = excluded.status;
