# Production Slice 01 contract

Authorized flow:

`Morning Briefing → cited Evidence question → recorded Decision → Approval → approved Action → Verified Outcome → Structured Handover`

## Architecture projection

- Home: Morning Briefing and current flow status.
- Inbox: pending approval request.
- Work: recorded decision, approved action and outcome.
- Organization: canonical navigation only; no Slice 01 expansion.
- Relationships: canonical navigation only; no Slice 01 expansion.
- Knowledge: cited evidence and source/version details.
- Automations: session, action execution and structured handover.
- Insights: verified outcome and audit trace.
- Calendar remains cross-cutting; Administration remains the tenant control plane.

## Existing contracts reused

| Slice object | Existing contract |
|---|---|
| Evidence and decision | `kos_knowledge_items` |
| Exact provenance | `kos_knowledge_sources`, `kos_documents`, `kos_document_versions` |
| Human gate | `kos_approvals` |
| Approved action and outcome | `kos_processing_jobs` |
| Continuity | `kos_agent_sessions`, `kos_session_steps`, `kos_agent_handovers` |
| Trace | `kos_audit_events` |
| Tenant and role boundary | `workspace_id`, RLS, `kos_is_member`, `kos_has_role` |

No new product module or competing source of truth is introduced. The Slice 01 migration may add only the minimal RPC/idempotency contract needed to make transitions atomic and permissioned.

## Transition laws

1. Every read and mutation is workspace-scoped and RLS-protected.
2. A decision retains an exact evidence source locator.
3. A pending approval cannot execute an action.
4. Only owner/admin may approve or reject.
5. Action execution is idempotent and requires an approved gate.
6. An outcome is not verified without an evidence reference and verifier.
7. Every transition appends an audit event.
8. The final handover is persisted and downloadable.
9. Loading, empty, error and responsive states are part of completion.
10. Slice 2 is not authorized by completion of this implementation branch.
