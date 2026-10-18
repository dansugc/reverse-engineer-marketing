// Local web app: `rem web`. Binds to 127.0.0.1 only and rejects foreign
// Host/Origin headers, because it can spawn the user's Claude Code / Codex.
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readConfig, writeConfig } from "../config.js";
import { detectEngines, writeReport, type EngineId } from "../engines.js";
import { AREAS, reverseEngineer, VERSION, type Area, type EvidenceBundle } from "../index.js";
import { renderMarkdown } from "../report/markdown.js";
import { validateReport } from "../report/validate.js";
import { listRuns, loadReport, loadRun, saveReport, saveRun } from "../runs.js";
import { PAGE } from "./page.js";

type Event = { type: string; [k: string]: unknown };

interface Job {
  id: string;
  runId?: string;
  events: Event[];
  listeners: Set<ServerResponse>;
  done: boolean;
  abort: AbortController;
}

const jobs = new Map<string, Job>();

function emit(job: Job, e: Event): void {
  job.events.push(e);
  const chunk = `data: ${JSON.stringify(e)}\n\n`;
  for (const res of job.listeners) res.write(chunk);
  if (e.type === "done") {
    job.done = true;
    for (const res of job.listeners) res.end();
    job.listeners.clear();
  }
}

/** Summary the UI renders while the report is being written. */
function bundleView(b: EvidenceBundle) {
  return {
    brand: b.brand,
    target: b.target,
    discovered: b.discovered,
    scorecard: b.scorecard,
    evidence: b.evidence,
    unknowns: b.unknowns,
    credits: b.credits,
    harness: b.harness,
    generatedAt: b.generatedAt,
    identity: b.identity ?? { logos: [], founders: [] },
    content: b.content ?? [],
  };
}

async function startJob(body: { url: string; engine: EngineId; model?: string; only?: Area[]; handles?: Record<string, string> }): Promise<Job> {
  const job: Job = { id: randomUUID().slice(0, 8), events: [], listeners: new Set(), done: false, abort: new AbortController() };
  jobs.set(job.id, job);
  void (async () => {
    try {
      emit(job, { type: "stage", stage: "collect", state: "start" });
      const bundle = await reverseEngineer(body.url, {
        only: body.only?.filter(a => AREAS.includes(a)),
        handles: body.handles,
        log: msg => emit(job, { type: "log", msg }),
        onStage: (stage, state, detail) => emit(job, { type: "stage", stage, state, detail }),
      });
      const { id } = await saveRun(bundle);
      job.runId = id;
      emit(job, { type: "stage", stage: "collect", state: "done" });
      emit(job, { type: "bundle", runId: id, bundle: bundleView(bundle) });

      if (body.engine === "none") {
        emit(job, { type: "report", markdown: renderMarkdown(bundle), engine: "none" });
      } else {
        emit(job, { type: "stage", stage: "write", state: "start" });
        const res = await writeReport(body.engine, bundle, {
          model: body.model || undefined,
          signal: job.abort.signal,
          onText: delta => emit(job, { type: "delta", text: delta, replace: body.engine === "codex" }),
          onStatus: msg => emit(job, { type: "status", msg }),
        });
        const validation = validateReport(res.markdown, bundle);
        await saveReport(id, res.markdown, { engine: body.engine, model: res.model });
        emit(job, { type: "stage", stage: "write", state: "done" });
        emit(job, { type: "report", markdown: res.markdown, engine: body.engine, model: res.model, validation });
      }
    } catch (err) {
      emit(job, { type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      emit(job, { type: "done" });
      setTimeout(() => jobs.delete(job.id), 30 * 60_000);
    }
  })();
  return job;
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<any> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("body too large");
  }
  return raw ? JSON.parse(raw) : {};
}

export function startWeb(port: number): Promise<string> {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const server = createServer(async (req, res) => {
    try {
      // DNS-rebinding / CSRF guard: only our own origin may talk to us.
      if (!allowedHosts.has(req.headers.host ?? "")) return json(res, 403, { error: "forbidden host" });
      const origin = req.headers.origin;
      if (req.method !== "GET" && origin && !allowedHosts.has(origin.replace(/^https?:\/\//, ""))) return json(res, 403, { error: "forbidden origin" });

      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const path = url.pathname;

      if (req.method === "GET" && path === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(PAGE);
      }
      if (req.method === "GET" && path === "/api/status") {
        const cfg = readConfig();
        return json(res, 200, {
          version: VERSION,
          engines: await detectEngines(),
          scrapecreators: { set: Boolean(process.env.SCRAPECREATORS_API_KEY || process.env.SCRAPE_CREATORS_API_KEY), fromConfig: Boolean(cfg.scrapecreatorsKey) },
          areas: AREAS,
        });
      }
      if (req.method === "POST" && path === "/api/settings") {
        const body = await readBody(req);
        if (typeof body.scrapecreatorsKey === "string") writeConfig({ scrapecreatorsKey: body.scrapecreatorsKey.trim() });
        return json(res, 200, { ok: true });
      }
      if (req.method === "GET" && path === "/api/runs") return json(res, 200, await listRuns());
      if (req.method === "POST" && path === "/api/runs") {
        const body = await readBody(req);
        if (typeof body.url !== "string" || !body.url.trim()) return json(res, 400, { error: "url is required" });
        if (!["claude-code", "codex", "anthropic-api", "none"].includes(body.engine)) return json(res, 400, { error: "bad engine" });
        const job = await startJob(body);
        return json(res, 200, { jobId: job.id });
      }
      const ev = path.match(/^\/api\/jobs\/([a-z0-9-]+)\/events$/);
      if (req.method === "GET" && ev) {
        const job = jobs.get(ev[1]!);
        if (!job) return json(res, 404, { error: "unknown job" });
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        for (const e of job.events) res.write(`data: ${JSON.stringify(e)}\n\n`);
        if (job.done) return res.end();
        job.listeners.add(res);
        req.on("close", () => job.listeners.delete(res));
        return;
      }
      const cancel = path.match(/^\/api\/jobs\/([a-z0-9-]+)\/cancel$/);
      if (req.method === "POST" && cancel) {
        jobs.get(cancel[1]!)?.abort.abort();
        return json(res, 200, { ok: true });
      }
      const run = path.match(/^\/api\/runs\/([A-Za-z0-9._-]+)$/);
      if (req.method === "GET" && run) {
        const bundle = await loadRun(run[1]!);
        const report = await loadReport(run[1]!);
        return json(res, 200, { runId: run[1], bundle: bundleView(bundle), report, validation: report ? validateReport(report.markdown, bundle) : null });
      }
      json(res, 404, { error: "not found" });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(`http://localhost:${port}`));
  });
}
