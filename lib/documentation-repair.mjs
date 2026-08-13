export function planDocumentationRepair(policy, driftRecord, proposal) {
  const risk = policy.severityRisk[driftRecord.severity];
  if (!risk) throw new Error(`Unsupported severity: ${driftRecord.severity}`);

  const missingEvidence = policy.requiredEvidence.filter((field) => proposal[field] === undefined || proposal[field] === null || proposal[field] === "");
  const touchesProtectedMeaning = proposal.fields.some((field) => policy.protectedFields.includes(field));
  const fieldsAutoApproved = proposal.fields.every((field) => policy.automaticFields.includes(field));
  const riskPolicy = policy.riskClasses[risk];

  let disposition = "review";
  if (missingEvidence.length) disposition = "blocked";
  else if (touchesProtectedMeaning || riskPolicy.action === "blocked") disposition = "blocked";
  else if (riskPolicy.action === "automatic" && fieldsAutoApproved) disposition = "automatic";

  return {
    drift_id: driftRecord.id,
    risk,
    disposition,
    requires_approval: disposition !== "automatic",
    missing_evidence: missingEvidence,
    protected_fields: proposal.fields.filter((field) => policy.protectedFields.includes(field)),
    rollback: {
      target_version: proposal.target_version,
      restore_value: proposal.previous_value,
      append_audit_event: true
    }
  };
}

