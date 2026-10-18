import Anthropic from "@anthropic-ai/sdk";
import { loadHarness, systemPrompt } from "../harness.js";
import type { EvidenceBundle } from "../index.js";

export const DEFAULT_MODEL = "claude-opus-5";

export interface SynthesisResult {
  markdown: string;
  model: string;
  usage: { input: number; output: number; cacheRead: number };
}

/**
 * Writes the strategy report from the evidence bundle with the harness as the
 * system prompt. The harness is stable across runs, so it is cached.
 */
export async function synthesize(bundle: EvidenceBundle, opts: { model?: string } = {}): Promise<SynthesisResult> {
  const harness = loadHarness();
  const client = new Anthropic();
  const model = opts.model ?? process.env.REM_MODEL ?? DEFAULT_MODEL;

  const stream = client.beta.messages.stream({
    model,
    max_tokens: 32_000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    // Server-side fallback: if the primary model declines, the API re-runs on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: systemPrompt(harness), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt(bundle) }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined to write this report.");
  const markdown = msg.content
    .flatMap(b => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  if (!markdown) throw new Error(`Empty report (stop_reason: ${msg.stop_reason})`);
  return {
    markdown,
    model: msg.model,
    usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens, cacheRead: msg.usage.cache_read_input_tokens ?? 0 },
  };
}

export function userPrompt(bundle: EvidenceBundle): string {
  const compact = {
    target: bundle.target,
    brand: bundle.brand,
    discovered: bundle.discovered,
    scorecard: bundle.scorecard,
    evidence: bundle.evidence.map(e => ({ id: e.id, source: e.source, kind: e.kind, title: e.title, url: e.url, data: e.data })),
    unknowns: bundle.unknowns,
    sourcesFailed: bundle.sources.filter(s => s.status !== "ok"),
  };
  return [
    `Reverse engineer the marketing of ${bundle.brand} (${bundle.target.domain ?? bundle.target.input}).`,
    `Today is ${bundle.generatedAt.slice(0, 10)}.`,
    "Here is the evidence bundle. Write the report in the required format, citing evidence ids for every fact.",
    "```json",
    JSON.stringify(compact, null, 1),
    "```",
  ].join("\n");
}
