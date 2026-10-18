// Offline harness eval: replay recorded evidence bundles through the current
// harness and score the reports with the validator. Change a prompt, playbook
// or lesson → run this → compare scores per harness SHA in evals/results.jsonl.
//
//   npm run eval              validate committed examples against their fixtures (free)
//   npm run eval -- --live    regenerate reports with Claude, then validate (costs tokens)
import { appendFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { synthesize } from "../src/analyze/synthesize.js";
import { loadHarness } from "../src/harness.js";
import type { EvidenceBundle } from "../src/index.js";
import { validateReport } from "../src/report/validate.js";

try {
  process.loadEnvFile(".env");
} catch {
  // optional
}

const live = process.argv.includes("--live");
const harness = loadHarness();
const fixtures = (await readdir("evals/fixtures")).filter(f => f.endsWith(".evidence.json"));
let failed = 0;

for (const f of fixtures) {
  const name = f.replace(/\.evidence\.json$/, "");
  const bundle = JSON.parse(await readFile(join("evals/fixtures", f), "utf8")) as EvidenceBundle;
  let markdown: string;
  let model = "recorded";
  if (live) {
    const res = await synthesize({ ...bundle, harness: { version: harness.version, sha: harness.sha } });
    markdown = res.markdown;
    model = res.model;
  } else {
    try {
      markdown = await readFile(join("examples", `${name}.md`), "utf8");
    } catch {
      console.log(`- ${name}: no examples/${name}.md (run with --live)`);
      continue;
    }
  }
  const v = validateReport(markdown, bundle);
  if (!v.ok) failed++;
  console.log(`${v.ok ? "✓" : "✗"} ${name}  score ${v.score}  (${model}, harness ${harness.version}/${harness.sha})`);
  for (const c of v.checks) console.log(`    ${c.ok ? "·" : "!"} ${c.name}: ${c.detail}`);
  if (live)
    await appendFile("evals/results.jsonl", `${JSON.stringify({ at: new Date().toISOString(), fixture: name, model, harness: harness.sha, score: v.score, checks: v.checks })}\n`);
}
process.exitCode = failed ? 1 : 0;
