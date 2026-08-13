create unique index if not exists kos_company_relationships_unique_edge on public.kos_company_relationships(workspace_id,source_company_id,target_company_id,relationship_type) where target_company_id is not null;
alter table public.kos_companies add column if not exists source_metadata jsonb not null default '{}'::jsonb;

update public.kos_companies c set source_metadata=e.metadata,updated_at=now() from public.entities e
where (e.id::text=c.legacy_entity_id or e.code=c.source_code) and c.source_metadata='{}'::jsonb;

with candidates as (
 select child.workspace_id,parent.id source_company_id,child.id target_company_id,'subsidiary'::text relationship_type,
 case when (e.metadata->>'ownership_pct') ~ '^\d+(\.\d+)?$' then (e.metadata->>'ownership_pct')::numeric else null end ownership_percent
 from public.kos_companies child join public.entities e on e.id::text=child.legacy_entity_id or e.code=child.source_code
 join public.kos_companies parent on parent.workspace_id=child.workspace_id and lower(btrim(parent.name))=lower(btrim(e.metadata->>'parent_name'))
 where nullif(e.metadata->>'parent_name','') is not null
)
insert into public.kos_company_relationships(workspace_id,source_company_id,target_company_id,relationship_type,ownership_percent)
select workspace_id,source_company_id,target_company_id,relationship_type,ownership_percent from candidates
on conflict (workspace_id,source_company_id,target_company_id,relationship_type) where target_company_id is not null do update set ownership_percent=excluded.ownership_percent;

with labels as (
 select ct.id,ct.workspace_id,coalesce(nullif(btrim(ct.company_name),''),nullif(btrim(ct.metadata->>'firm_company'),'')) label from public.kos_contacts ct where ct.company_id is null
), matches as (
 select l.id,l.workspace_id,(array_agg(c.id order by c.name))[1] company_id,count(*) match_count from labels l join public.kos_companies c on c.workspace_id=l.workspace_id and (lower(btrim(c.name))=lower(l.label) or lower(btrim(coalesce(c.legal_name,'')))=lower(l.label)) where l.label is not null group by l.id,l.workspace_id
), updated as (
 update public.kos_contacts ct set company_id=m.company_id,company_name=c.name,updated_at=now() from matches m join public.kos_companies c on c.id=m.company_id and c.workspace_id=m.workspace_id where ct.id=m.id and ct.workspace_id=m.workspace_id and m.match_count=1 returning ct.id,ct.workspace_id,ct.company_id
)
insert into public.kos_audit_events(workspace_id,actor_type,action,resource_type,resource_id,details)
select workspace_id,'system','contact.company_promoted','contact',id,jsonb_build_object('company_id',company_id,'method','exact_normalized_label') from updated;

insert into public.kos_audit_events(workspace_id,actor_type,action,resource_type,resource_id,details)
select r.workspace_id,'system','company.relationship_promoted','company',r.target_company_id,jsonb_build_object('parent_company_id',r.source_company_id,'relationship_type',r.relationship_type,'ownership_percent',r.ownership_percent,'method','legacy_entity_exact_match')
from public.kos_company_relationships r where r.relationship_type='subsidiary' and not exists(select 1 from public.kos_audit_events a where a.workspace_id=r.workspace_id and a.action='company.relationship_promoted' and a.resource_id=r.target_company_id);
