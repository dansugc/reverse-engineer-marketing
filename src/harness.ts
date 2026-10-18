// The harness is a versioned file bundle (prompt, guardrails, playbooks,
// lessons, template). Each report records the bundle version + SHA so a change
// to the prompt is a change you can see, eval and roll back.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface Harness {
  version: string;
  sha: string;
  dir: string;
  files: Record<string, string>;
}

export function harnessDir(): string {
  if (process.env.REM_HARNESS_DIR) return process.env.REM_HARNESS_DIR;
  // dist/harness.js and src/harness.ts both sit one level below the package root.
  return join(dirname(fileURLToPath(import.meta.url)), "..", "harness");
}

export function loadHarness(dir = harnessDir()): Harness {
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`Harness manifest not found at ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version: string; files: string[] };
  const files: Record<string, string> = {};
  const missing: string[] = [];
  const hash = createHash("sha256");
  for (const f of [...manifest.files].sort()) {
    const p = join(dir, f);
    if (!existsSync(p)) {
      missing.push(f);
      continue;
    }
    files[f] = readFileSync(p, "utf8");
    hash.update(`${f}\0${files[f]}\0`);
  }
  if (missing.length) throw new Error(`Harness is missing files: ${missing.join(", ")}`);
  return { version: manifest.version, sha: hash.digest("hex").slice(0, 12), dir, files };
}

/** System prompt = role + guardrails + template + lessons + all playbooks. Stable across runs (cacheable). */
export function systemPrompt(h: Harness): string {
  const playbooks = Object.entries(h.files)
    .filter(([f]) => f.startsWith("playbooks/"))
    .map(([, body]) => body.trim())
    .join("\n\n");
  return [h.files["system.md"], h.files["guardrails.md"], h.files["report-template.md"], h.files["lessons.md"], "# Channel playbooks\n\n" + playbooks]
    .map(s => (s ?? "").trim())
    .join("\n\n---\n\n");
}

export function playbook(h: Harness, name: string): string | null {
  const key = Object.keys(h.files).find(f => f === `playbooks/${name}.md` || f === name);
  return key ? h.files[key]! : null;
}
