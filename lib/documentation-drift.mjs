import { createHash } from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}

function record(area, severity, status, expected, actual, evidenceRef, message) {
  const input = JSON.stringify(stable({ area, expected, actual, evidenceRef }));
  return {
    id: createHash("sha256").update(input).digest("hex").slice(0, 24),
    area,
    severity,
    status,
    expected,
    actual,
    evidence_ref: evidenceRef,
    message
  };
}

export function compareDocumentationState(contract, observation) {
  const records = [];
  const github = observation.github ?? {};
  records.push(record(
    "github",
    github.repository === contract.canonicalRepository ? "GREEN" : "RED",
    github.repository === contract.canonicalRepository ? "current" : "drift",
    { repository: contract.canonicalRepository },
    { repository: github.repository ?? null },
    github.evidenceRef ?? null,
    "Canonical repository identity"
  ));

  const supabase = observation.supabase ?? {};
  const migrationMatch = JSON.stringify(supabase.liveMigrations ?? []) === JSON.stringify(supabase.repositoryMigrations ?? []);
  records.push(record(
    "supabase",
    supabase.project === contract.supabaseProject && migrationMatch && supabase.rlsVerified === true ? "GREEN" : "RED",
    supabase.project === contract.supabaseProject && migrationMatch && supabase.rlsVerified === true ? "current" : "drift",
    { project: contract.supabaseProject, migrations: supabase.repositoryMigrations ?? [], rlsVerified: true },
    { project: supabase.project ?? null, migrations: supabase.liveMigrations ?? [], rlsVerified: supabase.rlsVerified ?? null },
    supabase.evidenceRef ?? null,
    "Live schema, migration and RLS contract"
  ));

  const vercel = observation.vercel ?? {};
  const deploymentCurrent = vercel.project === contract.vercelProject && vercel.state === "READY" && vercel.sourceSha === github.mainSha;
  records.push(record(
    "vercel",
    deploymentCurrent ? "GREEN" : "AMBER",
    deploymentCurrent ? "current" : "drift",
    { project: contract.vercelProject, sourceSha: github.mainSha ?? null, state: "READY" },
    { project: vercel.project ?? null, sourceSha: vercel.sourceSha ?? null, state: vercel.state ?? null },
    vercel.evidenceRef ?? null,
    "Production deployment must match GitHub main"
  ));

  const docs = observation.documentation ?? {};
  const docsCurrent = docs.authorityVersion === contract.version && docs.canonicalRepository === contract.canonicalRepository;
  records.push(record(
    "documentation",
    docsCurrent ? "GREEN" : "AMBER",
    docsCurrent ? "current" : "drift",
    { authorityVersion: contract.version, canonicalRepository: contract.canonicalRepository },
    { authorityVersion: docs.authorityVersion ?? null, canonicalRepository: docs.canonicalRepository ?? null },
    docs.evidenceRef ?? null,
    "Governed documentation authority contract"
  ));

  return {
    schema_version: 1,
    health: records.some(({ severity }) => severity === "RED") ? "RED" : records.some(({ severity }) => severity === "AMBER") ? "AMBER" : "GREEN",
    records
  };
}

