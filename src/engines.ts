// Report writers. "claude-code" and "codex" run the locally installed CLIs,
// so the report is billed to the user's Claude or ChatGPT subscription, not an
// API key. API keys are stripped from their env so the subscription login wins.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { synthesize, userPrompt } from "./analyze/synthesize.js";
import { loadHarness, systemPrompt } from "./harness.js";
import type { EvidenceBundle } from "./index.js";

export type EngineId = "claude-code" | "codex" | "anthropic-api" | "none";

export interface EngineInfo {
  id: EngineId;
  label: string;
  available: boolean;
  detail: string;
}

export async function detectEngines(): Promise<EngineInfo[]> {
  const [claude, codex] = await Promise.all([version("claude"), version("codex")]);
  const api = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return [
    { id: "claude-code", label: "Claude Code", available: Boolean(claude), detail: claude ? `${claude} · uses your Claude subscription` : "not installed (npm i -g @anthropic-ai/claude-code)" },
    { id: "codex", label: "Codex", available: Boolean(codex), detail: codex ? `${codex} · uses your ChatGPT subscription` : "not installed (npm i -g @openai/codex)" },
    { id: "anthropic-api", label: "Anthropic API", available: api, detail: api ? "ANTHROPIC_API_KEY · billed per token" : "set ANTHROPIC_API_KEY" },
    { id: "none", label: "Evidence only", available: true, detail: "no AI, raw evidence report" },
  ];
}

function version(bin: string): Promise<string | null> {
  return new Promise(resolve => {
    const p = spawn(bin, ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    p.stdout.on("data", d => (out += d));
    p.on("error", () => resolve(null));
    p.on("close", code => resolve(code === 0 ? out.trim().split("\n")[0]!.slice(0, 60) : null));
    setTimeout(() => (p.kill(), resolve(null)), 8000);
  });
}

export interface WriteOptions {
  model?: string;
  onText?: (delta: string) => void;
  onStatus?: (msg: string) => void;
  signal?: AbortSignal;
}

export async function writeReport(engine: EngineId, bundle: EvidenceBundle, opts: WriteOptions = {}): Promise<{ markdown: string; model?: string }> {
  if (engine === "claude-code") return claudeCode(bundle, opts);
  if (engine === "codex") return codex(bundle, opts);
  if (engine === "anthropic-api") {
    const res = await synthesize(bundle, { model: opts.model, onText: opts.onText });
    return { markdown: res.markdown, model: res.model };
  }
  throw new Error(`Engine ${engine} does not write reports`);
}

/** A scratch cwd so the CLIs don't pick up a project's CLAUDE.md / AGENTS.md. */
function scratchDir(): string {
  const dir = join(tmpdir(), "reverse-engineer-marketing-engine");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function envWithout(...keys: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of keys) delete env[k];
  return env;
}

function claudeCode(bundle: EvidenceBundle, opts: WriteOptions): Promise<{ markdown: string; model?: string }> {
  const args = [
    "-p",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--tools", "",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--setting-sources", "project",
    "--system-prompt", systemPrompt(loadHarness()),
  ];
  if (opts.model) args.push("--model", opts.model);
  return new Promise((resolve, reject) => {
    const p = spawn("claude", args, { cwd: scratchDir(), env: envWithout("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"), signal: opts.signal });
    let text = "";
    let model: string | undefined;
    let final: string | undefined;
    let error: string | undefined;
    let stderr = "";
    p.stderr.on("data", d => (stderr = (stderr + d).slice(-2000)));
    createInterface({ input: p.stdout }).on("line", line => {
      let m: any;
      try {
        m = JSON.parse(line);
      } catch {
        return;
      }
      if (m.type === "system" && m.subtype === "init") {
        model = m.model;
        opts.onStatus?.(`Claude Code (${m.model}${m.apiKeySource && m.apiKeySource !== "none" ? `, ${m.apiKeySource}` : ", subscription"}) is writing…`);
      } else if (m.type === "stream_event" && m.event?.type === "content_block_delta" && m.event.delta?.type === "text_delta") {
        text += m.event.delta.text;
        opts.onText?.(m.event.delta.text);
      } else if (m.type === "result") {
        if (m.is_error) error = String(m.result || m.subtype || "Claude Code failed");
        else final = m.result;
      }
    });
    p.on("error", err => reject(err));
    p.on("close", code => {
      const markdown = (final ?? text).trim();
      if (error) reject(new Error(error));
      else if (!markdown) reject(new Error(`Claude Code exited ${code} with no output${stderr ? `: ${stderr.trim().slice(-400)}` : ""}`));
      else resolve({ markdown, model });
    });
    p.stdin.end(userPrompt(bundle));
  });
}

function codex(bundle: EvidenceBundle, opts: WriteOptions): Promise<{ markdown: string; model?: string }> {
  const args = ["exec", "--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--ignore-rules", "-s", "read-only", "--json"];
  if (opts.model) args.push("-m", opts.model);
  args.push("-");
  const prompt = [
    "<instructions>",
    systemPrompt(loadHarness()),
    "</instructions>",
    "",
    userPrompt(bundle),
    "",
    "Do not run shell commands or read files: everything you need is above. Reply with only the Markdown report.",
  ].join("\n");
  return new Promise((resolve, reject) => {
    const p = spawn("codex", args, { cwd: scratchDir(), env: envWithout("OPENAI_API_KEY"), signal: opts.signal });
    let last = "";
    let failure: string | undefined;
    let stderr = "";
    p.stderr.on("data", d => (stderr = (stderr + d).slice(-2000)));
    opts.onStatus?.("Codex (subscription) is thinking…");
    createInterface({ input: p.stdout }).on("line", line => {
      let m: any;
      try {
        m = JSON.parse(line);
      } catch {
        return;
      }
      const item = m.item;
      if (m.type === "item.completed" && item?.type === "agent_message" && item.text) {
        last = item.text;
        opts.onText?.(item.text);
      } else if ((m.type === "item.started" || m.type === "item.completed") && item?.type === "reasoning") {
        opts.onStatus?.("Codex is reasoning…");
      } else if ((m.type === "item.started" || m.type === "item.completed") && item?.type === "command_execution") {
        opts.onStatus?.(`Codex ran: ${String(item.command ?? "").slice(0, 80)}`);
      } else if (m.type === "turn.failed" || m.type === "error") {
        failure = m.error?.message ?? m.message ?? "Codex failed";
      }
    });
    p.on("error", err => reject(err));
    p.on("close", code => {
      if (last.trim()) resolve({ markdown: last.trim() });
      else reject(new Error(failure ?? `Codex exited ${code} with no output${stderr ? `: ${stderr.trim().slice(-400)}` : ""}`));
    });
    p.stdin.end(prompt);
  });
}
