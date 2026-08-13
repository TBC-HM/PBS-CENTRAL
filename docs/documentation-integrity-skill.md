# Documentation Integrity Skill Definition

## Objective

Detect, classify and safely route contradictions between PBS CENTRAL documentation and its authorized live sources without creating a competing source of truth.

## Inputs

- `config/documentation-authority.json`
- authorized GitHub main commit evidence
- authorized Supabase migration and RLS evidence
- authorized Vercel production deployment evidence
- current governed documentation authority version

## Procedure

1. Confirm all resource identifiers match the authorized PBS CENTRAL scope.
2. Collect current evidence with bounded retries and provenance references.
3. Run `scripts/check-documentation-drift.mjs`.
4. Classify the overall and per-source result as GREEN, AMBER or RED.
5. For a proposed repair, run the policy in `lib/documentation-repair.mjs`.
6. Apply only an `automatic` low-risk repair. Route `review` for approval and stop on `blocked`.
7. Preserve evidence, health output, repair plan and rollback data in the audit trail.
8. Update the active PBS CENTRAL session handover with findings and next action.

## Prohibitions

- No cross-project discovery or access.
- No guessed evidence when a source is unavailable.
- No automatic changes to permissions, tenant scope, security controls, RLS or migration history.
- No silent conflict resolution between documentation and live implementation.
- No durable local project memory.

## Outputs

- machine-readable health record with stable drift identifiers
- evidence references for each checked source
- risk-gated repair plan where applicable
- append-only handover/audit update

## Completion conditions

All authorized sources were checked or explicitly reported blocked; health is emitted; dangerous repairs remain blocked; tests pass; and the result is recorded in PBS CENTRAL.
