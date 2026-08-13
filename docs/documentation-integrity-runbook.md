# Documentation Integrity Runbook

## Purpose

Verify that PBS CENTRAL documentation still agrees with the authorized live GitHub, Supabase and Vercel sources. The verifier reports drift; it never changes protected security, tenant, permission or migration meaning.

## Authorized scope

- GitHub: `TBC-HM/PBS-CENTRAL`
- Supabase: `gjxifmrqnzcrdhykpxqn`
- Vercel: `pbs-central-knowledge-os-preview`

Stop if any resolved resource differs from this scope.

## Scheduled operation

The `PBS Central Documentation Integrity` GitHub Actions workflow runs daily at 05:17 UTC and can also be dispatched manually. Runs are serialized and retain their evidence and health artifacts for 30 days.

Required repository secrets:

- `PBS_CENTRAL_SUPABASE_ACCESS_TOKEN`: least-privilege token that can list applied migrations for the authorized project.
- `PBS_CENTRAL_VERCEL_TOKEN`: least-privilege token that can read deployments for the authorized project.

Do not place token values in source, documentation, logs or session handovers.

## Manual verification

From an ephemeral authorized checkout with the five required environment variables set:

```sh
node scripts/collect-documentation-evidence.mjs documentation-evidence.json
node scripts/check-documentation-drift.mjs documentation-evidence.json > documentation-health.json
```

The collector retries transient source failures three times. Missing credentials or exhausted retries are blocked conditions, never GREEN evidence.

## Health response

- GREEN: archive the evidence and health artifacts. Automatic repair is permitted only for policy-allowlisted low-risk facts with provenance and rollback.
- AMBER: inspect the named evidence source. Review deployment lag or stale documentation before changing canonical material.
- RED: stop automatic repair. Open or update the governed PBS CENTRAL issue/session with the drift identifier, expected value, actual value and evidence reference.

## Known baseline finding

The live Supabase migration ledger contains historical entries that are not represented by the two migration files currently in the repository. This is RED migration-history drift. Reconciliation requires reviewed database governance work; never manufacture migration files or rewrite the live ledger merely to make the detector GREEN.

## Recovery and rollback

For an allowed low-risk repair, preserve the previous value, target version, source reference, observation time, actor and idempotency key. Roll back by restoring the preserved value and appending a new audit event. Never delete or overwrite the original audit record.

## Escalation

Escalate immediately when drift affects tenant isolation, permissions, authentication, auditability, RLS or migration history. The owner must approve any consequential correction.
