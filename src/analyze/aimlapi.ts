// AI/ML API report writer: OpenAI-compatible chat completions on api.aimlapi.com,
// billed per token to the user's AI/ML API account (AIMLAPI_API_KEY).
import { loadHarness, systemPrompt } from "../harness.js";
import type { EvidenceBundle } from "../index.js";
import { userPrompt, type SynthesisResult } from "./synthesize.js";

export const AIMLAPI_BASE_URL = "https://api.aimlapi.com/v1";
export const AIMLAPI_HOST = "api.aimlapi.com";
export const AIMLAPI_DEFAULT_MODEL = "anthropic/claude-opus-5";

export function aimlapiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.AIMLAPI_API_KEY?.trim() || undefined;
}

/** The key is only ever sent to https://api.aimlapi.com, never to another host or port. */
export function assertAimlapiUrl(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.hostname !== AIMLAPI_HOST || u.port !== "" || u.username || u.password) throw new Error(`Refusing to send the AI/ML API key to ${u.origin}`);
  return u;
}

export interface AimlapiOptions {
  model?: string;
  onText?: (delta: string) => void;
  signal?: AbortSignal;
  /** For tests. Defaults to AIMLAPI_BASE_URL. */
  baseUrl?: string;
  fetch?: typeof fetch;
}

export async function synthesizeAimlapi(bundle: EvidenceBundle, opts: AimlapiOptions = {}): Promise<SynthesisResult> {
  const key = aimlapiKey();
  if (!key) throw new Error("AIMLAPI_API_KEY is not set");
  const url = assertAimlapiUrl(`${opts.baseUrl ?? AIMLAPI_BASE_URL}/chat/completions`);
  const model = opts.model ?? process.env.AIMLAPI_MODEL ?? AIMLAPI_DEFAULT_MODEL;
  const res = await (opts.fetch ?? fetch)(url, {
    method: "POST",
    // Redirects are not followed: the key must not travel to wherever a Location points.
    redirect: "manual",
    signal: opts.signal,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({
      model,
      max_tokens: 32_000,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: systemPrompt(loadHarness()) },
        { role: "user", content: userPrompt(bundle) },
      ],
    }),
  });
  if (res.status >= 300 && res.status < 400) throw new Error(`AI/ML API answered with a redirect (${res.status}); not following it`);
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 400);
    throw new Error(`AI/ML API error ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  let markdown = "";
  let usedModel = model;
  let finish: string | undefined;
  const usage = { input: 0, output: 0, cacheRead: 0 };
  const decoder = new TextDecoder();
  let buf = "";
  const onLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let m: any;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (m.error) throw new Error(`AI/ML API error: ${m.error.message ?? JSON.stringify(m.error).slice(0, 300)}`);
    if (typeof m.model === "string" && m.model) usedModel = m.model;
    const choice = m.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta) {
      markdown += delta;
      opts.onText?.(delta);
    }
    if (choice?.finish_reason) finish = choice.finish_reason;
    if (m.usage) {
      usage.input = m.usage.prompt_tokens ?? usage.input;
      usage.output = m.usage.completion_tokens ?? usage.output;
      usage.cacheRead = m.usage.prompt_tokens_details?.cached_tokens ?? usage.cacheRead;
    }
  };
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      onLine(buf.slice(0, nl).replace(/\r$/, ""));
      buf = buf.slice(nl + 1);
    }
  }
  onLine(buf.trim());

  markdown = markdown.trim();
  if (finish === "content_filter") throw new Error("The model declined to write this report.");
  if (!markdown) throw new Error(`Empty report (finish_reason: ${finish ?? "none"})`);
  return { markdown, model: usedModel, usage };
}
