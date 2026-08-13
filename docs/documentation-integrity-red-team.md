# Documentation Integrity Red-Team Report

Date: 2026-08-13  
Session: `documentation-integrity-v1`  
Authorized scope: `TBC-HM/PBS-CENTRAL`, Supabase `gjxifmrqnzcrdhykpxqn`, Vercel `pbs-central-knowledge-os-preview`

## Scenarios and results

| Scenario | Expected control | Result |
| --- | --- | --- |
| Current evidence from all sources | GREEN with evidence references | PASS |
| Stale authority version | AMBER drift; stable drift identifier | PASS |
| Production deployment behind GitHub main | AMBER, no source-of-truth weakening | PASS |
| Repository identity contradiction | RED | PASS |
| Live migration history differs from repository | RED | PASS |
| RLS verification absent | RED | PASS |
| Live-source credentials unavailable | Blocked RED; no guessed evidence | PASS |
| Protected security, tenant, permission or migration field repair | Blocked; approval required | PASS |
| Low-risk factual repair | Automatic only with provenance and rollback | PASS |

## Live finding

The authorized live check remains RED for migration-history drift: the repository contains two Slice 1 migration files while the live Supabase migration ledger contains additional historical entries. The detector correctly refuses to rewrite or conceal this history.

## Residual risks

- GitHub Actions needs the repository secrets `PBS_CENTRAL_SUPABASE_ACCESS_TOKEN` and `PBS_CENTRAL_VERCEL_TOKEN` before the scheduled live check can succeed.
- The current collector records that RLS was verified by the governed operator. Automating a complete RLS policy comparison remains a later hardening task; it must not be represented as complete.
- Audit artifacts are retained for 30 days in GitHub Actions. Durable governed findings must also be written into PBS CENTRAL session handovers.
- Migration-history reconciliation is consequential database governance work and must be reviewed; it is never eligible for automatic repair.

## Verification

The application test suite covers the scenarios above. TypeScript and the production build must also pass before this step is accepted.
