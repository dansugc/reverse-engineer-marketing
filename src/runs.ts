// Saved runs (evidence bundle + optional report), shared by the MCP server and the web app.
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { EvidenceBundle } from "./index.js";

export const DATA_DIR = process.env.REM_CACHE_DIR || join(homedir(), ".cache", "reverse-engineer-marketing");
export const RUNS_DIR = join(DATA_DIR, "runs");

const safe = (id: string) => id.replace(/[^a-z0-9._-]/gi, "");

export function runId(bundle: EvidenceBundle): string {
  return `${(bundle.target.domain ?? bundle.brand).replace(/[^a-z0-9.-]/gi, "_")}-${bundle.generatedAt.replace(/[-:T]/g, "").slice(0, 12)}`;
}

export async function saveRun(bundle: EvidenceBundle): Promise<{ id: string; path: string }> {
  const id = runId(bundle);
  await mkdir(RUNS_DIR, { recursive: true });
  const path = join(RUNS_DIR, `${id}.json`);
  await writeFile(path, JSON.stringify(bundle, null, 2));
  return { id, path };
}

export async function saveReport(id: string, markdown: string, meta: { engine: string; model?: string }): Promise<void> {
  await mkdir(RUNS_DIR, { recursive: true });
  await writeFile(join(RUNS_DIR, `${safe(id)}.md`), markdown);
  await writeFile(join(RUNS_DIR, `${safe(id)}.meta.json`), JSON.stringify({ ...meta, at: new Date().toISOString() }));
}

export async function loadRun(id: string): Promise<EvidenceBundle> {
  try {
    return JSON.parse(await readFile(join(RUNS_DIR, `${safe(id)}.json`), "utf8")) as EvidenceBundle;
  } catch {
    throw new Error(`Unknown run "${id}"`);
  }
}

export async function loadReport(id: string): Promise<{ markdown: string; engine?: string; model?: string } | null> {
  try {
    const markdown = await readFile(join(RUNS_DIR, `${safe(id)}.md`), "utf8");
    const meta = JSON.parse(await readFile(join(RUNS_DIR, `${safe(id)}.meta.json`), "utf8").catch(() => "{}"));
    return { markdown, ...meta };
  } catch {
    return null;
  }
}

export interface RunSummary {
  id: string;
  brand: string;
  domain?: string;
  at: string;
  evidence: number;
  hasReport: boolean;
  logo?: string;
}

export async function listRuns(limit = 50): Promise<RunSummary[]> {
  let files: string[];
  try {
    files = (await readdir(RUNS_DIR)).filter(f => f.endsWith(".json") && !f.endsWith(".meta.json"));
  } catch {
    return [];
  }
  const withTime = await Promise.all(files.map(async f => ({ f, t: (await stat(join(RUNS_DIR, f))).mtimeMs })));
  const recent = withTime.sort((a, b) => b.t - a.t).slice(0, limit);
  const out: RunSummary[] = [];
  for (const { f } of recent) {
    const id = f.slice(0, -5);
    try {
      const b = JSON.parse(await readFile(join(RUNS_DIR, f), "utf8")) as EvidenceBundle;
      const hasReport = await stat(join(RUNS_DIR, `${id}.md`)).then(() => true, () => false);
      out.push({ id, brand: b.brand, domain: b.target.domain, at: b.generatedAt, evidence: b.evidence.length, hasReport, logo: b.identity?.logo });
    } catch {
      // skip unreadable
    }
  }
  return out;
}
