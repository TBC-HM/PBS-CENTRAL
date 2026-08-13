import { readFile } from "node:fs/promises";
import { compareDocumentationState } from "../lib/documentation-drift.mjs";

const evidencePath = process.argv[2];
if (!evidencePath) throw new Error("Usage: node scripts/check-documentation-drift.mjs <evidence.json>");

const contract = JSON.parse(await readFile(new URL("../config/documentation-authority.json", import.meta.url), "utf8"));
const observation = JSON.parse(await readFile(evidencePath, "utf8"));
const result = compareDocumentationState(contract, observation);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.health === "RED" ? 2 : result.health === "AMBER" ? 1 : 0;

