# PBS CENTRAL Second Brain — Actual Capability Audit

Date: 2026-08-13  
Session: `second-brain-memory-v2` Step 2  
Authorized workspace: `50e961ca-0c20-4f42-8c69-d0f62b9a8192`

## Outcome

PBS CENTRAL already contains useful canonical knowledge, documents, provenance, sessions, handovers and artifacts. The production UI currently exposes only the Slice 1 evidence-to-outcome path. The next implementation must project the existing governed data into the approved eight-area architecture; it must not create a second knowledge store.

## Live inventory

| Capability | Live evidence | Current UI | Assessment |
| --- | ---: | --- | --- |
| Knowledge | 15 `kos_knowledge_items` | Latest verified/reviewed items in Knowledge | Partial |
| Provenance | 28 `kos_knowledge_sources` | Not displayed | Data exists, UI missing |
| Documents | 58 `kos_documents` | Not displayed | Data exists, UI missing |
| Immutable versions | 1 `kos_document_versions` | Not displayed | Early/partial registry |
| Document relationships | 160 `kos_document_links` | Not displayed | Data exists, graph projection missing |
| Sessions | 12 `kos_agent_sessions` | Not displayed | Data exists, UI missing |
| Handovers | 75 `kos_agent_handovers` | Download only for Slice 1 | Data exists, browser missing |
| Session artifacts | 60 `kos_session_artifacts` | Not displayed | Data exists, UI missing |
| Full-text search | `search_document` exists on knowledge items | No search UI | Storage primitive exists |
| Vector retrieval | `embedding` exists on knowledge items | No retrieval contract/UI | Unverified implementation |
| Memory tiers | No explicit governed memory state | No UI | Missing |
| Contradictions/supersession | Discovery contradictions exist, no general memory workflow | No UI | Missing |
| Human graph | Document links and knowledge sources provide edges | No graph UI | Projection missing |

## Current implementation evidence

- `app/workspace/page.tsx` resolves the authenticated workspace and reads knowledge, approvals and processing jobs.
- `components/workspace-shell.tsx` renders the eight canonical areas but only Home, Knowledge, Inbox, Work, Insights and Automations have Slice 1-specific content.
- Organization and Relationships are placeholders.
- Knowledge shows verified/reviewed evidence only; it does not expose documents, sources, decisions, research, sessions, handovers, memory state or graph relationships.
- No application search, graph, promotion, retention, contradiction or supersession service currently exists in the repository.

## Security evidence

The inspected knowledge, source, document, session, handover and artifact tables use workspace membership for SELECT and workspace role checks for mutation. Every application query must still include the resolved `workspace_id`; RLS is defense in depth, not a substitute for explicit tenant scoping.

## Capability gaps ordered for implementation

1. Define a governed tier state machine as metadata/projection over canonical sources.
2. Define promotion, demotion, expiry, supersession and legal-hold rules.
3. Add tenant-scoped retrieval that filters before ranking and returns citations.
4. Project existing documents, knowledge, provenance, sessions and handovers into the approved Knowledge experience.
5. Add contradiction review without overwriting history.
6. Add a relationship graph derived only from canonical links and sources.
7. Prove cross-workspace denial for direct, retrieval, graph and background/service flows.

## Drift and risks

- The live database has materially more migration history than the repository. Schema work must be additive and reviewed; no attempt will be made to rewrite history.
- The database has vector and full-text primitives, but their actual retrieval behavior and authorization order are not proven.
- Existing knowledge metadata contains historical references to an obsolete repository identifier. Those references are evidence/history and must not be silently rewritten.
- A complete general Second Brain is broader than one screen. Implementation will follow the persisted steps and remain inside the approved eight-area architecture.
