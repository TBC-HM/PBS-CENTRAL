# PBS CENTRAL documentation authority

This policy governs documentation drift. It does not create a second source of truth.

## Authority matrix

| Area | Authoritative source | Document role | Owner | Freshness SLA |
| --- | --- | --- | --- | --- |
| Production runtime | Current PBS CENTRAL Vercel production deployment | Explain verified behavior and rollback evidence | Engineering | Verify after every production deployment |
| Application behavior | `TBC-HM/PBS-CENTRAL` `main` at the deployed commit | Describe contracts and operating procedures | Engineering | Update in the same PR as behavior changes |
| Database and permissions | Supabase project `gjxifmrqnzcrdhykpxqn`: migrations, live schema, grants and RLS | Explain schema intent and migration consequences | Data/security | Update in the same migration PR; verify after apply |
| Architecture and product law | Ratified architecture/decision knowledge in PBS CENTRAL | Record durable boundaries and approved trade-offs | Owner/architecture | Review on each consequential architecture change |
| Sessions and handovers | `kos_agent_sessions`, steps, artifacts and handovers | Preserve execution continuity and evidence | Executing session | Checkpoint after every completed step |
| Vercel configuration | PBS CENTRAL Vercel project `pbs-central-knowledge-os-preview` | Record deployment contract, not secret values | Engineering/operations | Verify after configuration or deployment changes |
| External-provider behavior | Provider primary documentation plus live PBS CENTRAL configuration | Record versioned assumptions and constraints | Relevant integration owner | Review every 90 days or on provider change |

## Conflict rule

1. Production/runtime evidence describes what is happening now.
2. Deployed repository code and live database configuration describe how it happens.
3. Ratified architecture and product law describe what is allowed.
4. A mismatch between runtime/code and ratified law is a product defect, not permission to rewrite the law.
5. A mismatch between explanatory documentation and verified implementation is documentation drift.
6. Security, tenant isolation, permissions and architecture meaning are never auto-repaired.

## Freshness states

- **Current** — verified within the SLA and linked to an immutable commit, migration, deployment or knowledge identifier.
- **Due** — SLA expired, but no contradictory evidence is known.
- **Stale** — verified evidence contradicts the document or its named source no longer exists.
- **Blocked** — the authoritative source is unavailable or permission to inspect it is absent.

## Severity model

| Severity | Meaning | Required response |
| --- | --- | --- |
| RED | Security, tenant isolation, permissions, destructive operations, production identity or ratified architecture is contradicted | Stop affected automation; require human review and explicit approval |
| AMBER | Operational behavior, deployment state, schema description or active handover is materially stale | Open a governed repair item; repair only after evidence review |
| GREEN | No meaningful drift, or a low-risk factual field can be deterministically refreshed | Record evidence; allow history-preserving automatic repair only for approved fields |

## Approved automatic repairs

Only immutable, low-risk facts may be refreshed automatically: commit SHA, deployment ID/status, check result, verification timestamp and document freshness state. Every repair must preserve the previous value, source reference, actor, timestamp and idempotency key.

Names, architecture meaning, access rules, RLS policies, role mappings, tenant scope, secrets, costs and irreversible state require review.

