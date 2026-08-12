# Phase 0 final gate

Phase 0 may be declared GREEN only when all of these are evidenced against authorized PBS CENTRAL resources:

- Canonical source is `TBC-HM/PBS-CENTRAL` and CI passes.
- Vercel preview builds from the tested commit; production remains independently recoverable.
- Unauthenticated workspace access redirects to sign-in.
- Workspace reads are constrained by Supabase RLS and active membership.
- Cross-tenant negative tests return no foreign workspace or membership rows.
- Session step completion and its structured handover commit atomically.
- Replaying the same completion idempotency key returns the same handover without duplication.
- Security advisors contain no unresolved Phase 0 blocker.
- The authoritative PBS CENTRAL session and Document Registry are updated.

No production vertical slice starts before every gate item is satisfied.
