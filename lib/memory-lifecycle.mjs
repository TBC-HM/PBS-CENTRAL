export function evaluateMemoryTransition(contract, request) {
  if (!request.workspace_id) return { allowed: false, reason: "workspace_scope_required" };
  if (!request.source_refs?.length && request.to !== "archived") return { allowed: false, reason: "source_provenance_required" };
  if (request.actor_type === "agent" && ["verified", "policy"].includes(request.to))
    return { allowed: false, reason: "agents_cannot_self_promote" };

  const transition = contract.transitions.find(({ from, to }) => from === request.from && to === request.to);
  if (!transition) return { allowed: false, reason: "transition_not_permitted" };
  if (!transition.actors.includes(request.actor_role)) return { allowed: false, reason: "insufficient_role" };
  if (transition.requiresApproval && !request.approval_id) return { allowed: false, reason: "approval_required" };

  return {
    allowed: true,
    reason: "governed_transition",
    audit: {
      workspace_id: request.workspace_id,
      from: request.from,
      to: request.to,
      source_refs: request.source_refs ?? [],
      approval_id: request.approval_id ?? null,
      previous_record_id: request.previous_record_id ?? null,
      append_only: contract.rules.appendOnlyHistory
    }
  };
}

export function retentionDisposition(contract, memory, now = new Date()) {
  if (memory.state === "legal_hold") return { action: "retain", reason: "legal_hold" };
  const tier = contract.tiers[memory.tier];
  if (!tier) return { action: "review", reason: "unknown_tier" };
  if (!memory.expires_at) return { action: "retain", reason: "no_expiry" };
  return new Date(memory.expires_at) <= now
    ? { action: "expire", reason: "retention_elapsed" }
    : { action: "retain", reason: "within_retention" };
}
