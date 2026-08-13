# PBS CENTRAL Tiered Memory Lifecycle

Memory is a governed projection over canonical evidence, knowledge, sessions and handovers. It is not a new source of truth. Original evidence and immutable document versions remain outside the memory hierarchy.

## Tiers

| Tier | Purpose | Promotion authority | Default lifecycle |
| --- | --- | --- | --- |
| Working | Request-scoped context assembled for one operation | System within an authority envelope | 24-hour TTL |
| Session | Bounded session context and structured handover memory | System or workspace member | 30-day default TTL |
| Candidate | Proposed reusable knowledge requiring review | Member, admin or owner with provenance | Review within 14 days |
| Verified | Human-approved institutional knowledge | Admin or owner with evidence and approval | Review within 180 days |
| Policy | Restricted rules that constrain behavior | Owner with evidence and approval | Review within 90 days |

Archive, superseded, expired, tombstoned and legal-hold are lifecycle states rather than additional truth tiers.

## Promotion law

- Every durable record carries `workspace_id`, provenance, actor, timestamps and an append-only transition history.
- Confidence is advisory and never grants permission.
- Agents may propose candidate memory but may not promote themselves to verified or policy memory.
- Verified and policy promotion requires an authorized human approval.
- Supersession links old and new records; it never overwrites history.
- Tenant filtering happens before retrieval or ranking.

## Retention law

- Tier defaults are policy inputs, not destructive timers.
- Legal hold overrides expiry, archival and purge.
- Expired or tombstoned projections are excluded from normal retrieval but remain auditable until controlled purge.
- Purge requires dependency, hold and authority checks across canonical and derived data.

The machine-readable contract is `config/memory-lifecycle.json`; transition and retention checks are implemented in `lib/memory-lifecycle.mjs`.
