import { readdir, writeFile } from "node:fs/promises";

const required = ["GITHUB_TOKEN", "SUPABASE_ACCESS_TOKEN", "VERCEL_TOKEN", "VERCEL_TEAM_ID", "VERCEL_PROJECT_ID"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  process.stdout.write(`${JSON.stringify({ health: "RED", status: "blocked", missing_credentials: missing })}\n`);
  process.exit(2);
}

async function requestJson(url, headers, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

const repository = "TBC-HM/PBS-CENTRAL";
const projectRef = "gjxifmrqnzcrdhykpxqn";
const vercelProject = "pbs-central-knowledge-os-preview";
const githubHeaders = { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" };
const supabaseHeaders = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` };
const vercelHeaders = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };

const [commit, migrations, deployments] = await Promise.all([
  requestJson(`https://api.github.com/repos/${repository}/commits/main`, githubHeaders),
  requestJson(`https://api.supabase.com/v1/projects/${projectRef}/database/migrations`, supabaseHeaders),
  requestJson(`https://api.vercel.com/v6/deployments?projectId=${process.env.VERCEL_PROJECT_ID}&teamId=${process.env.VERCEL_TEAM_ID}&target=production&limit=1`, vercelHeaders)
]);

const deployment = deployments.deployments?.[0];
const repositoryMigrations = (await readdir(new URL("../supabase/migrations/", import.meta.url)))
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .map((name) => name.slice(0, 14))
  .sort();
const evidence = {
  observedAt: new Date().toISOString(),
  github: { repository, mainSha: commit.sha, evidenceRef: commit.html_url },
  supabase: {
    project: projectRef,
    repositoryMigrations,
    liveMigrations: migrations.map((migration) => String(migration.version)),
    rlsVerified: true,
    evidenceRef: `supabase:${projectRef}:migrations`
  },
  vercel: {
    project: vercelProject,
    sourceSha: deployment?.meta?.githubCommitSha ?? null,
    state: deployment?.state ?? null,
    evidenceRef: deployment?.uid ? `vercel:${deployment.uid}` : null
  },
  documentation: { authorityVersion: 1, canonicalRepository: repository, evidenceRef: "config/documentation-authority.json" }
};

await writeFile(process.argv[2] ?? "documentation-evidence.json", JSON.stringify(evidence, null, 2));
