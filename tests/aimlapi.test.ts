import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertAimlapiUrl, synthesizeAimlapi } from "../src/analyze/aimlapi.js";
import { detectEngines } from "../src/engines.js";
import type { EvidenceBundle } from "../src/index.js";

const bundle = JSON.parse(readFileSync(new URL("../evals/fixtures/calai.app.evidence.json", import.meta.url), "utf8")) as EvidenceBundle;
const KEY = "test-key-not-real";

function sse(...events: unknown[]): Response {
  const body = events.map(e => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("AI/ML API engine", () => {
  beforeEach(() => vi.stubEnv("AIMLAPI_API_KEY", KEY));
  afterEach(() => vi.unstubAllEnvs());

  it("streams an OpenAI-compatible chat completion from api.aimlapi.com with a bearer key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: URL | string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return sse(
        { model: "anthropic/claude-opus-5", choices: [{ delta: { content: "# Report\n" } }] },
        { choices: [{ delta: { content: "Body [E1]" }, finish_reason: "stop" }] },
        { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } },
        "[DONE]",
      );
    }) as typeof fetch;
    const deltas: string[] = [];
    const res = await synthesizeAimlapi(bundle, { fetch: fake, onText: d => deltas.push(d) });
    expect(res.markdown).toBe("# Report\nBody [E1]");
    expect(res.model).toBe("anthropic/claude-opus-5");
    expect(res.usage).toMatchObject({ input: 10, output: 5 });
    expect(deltas).toEqual(["# Report\n", "Body [E1]"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.aimlapi.com/v1/chat/completions");
    expect(calls[0]!.init.redirect).toBe("manual");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ model: "anthropic/claude-opus-5", stream: true });
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
  });

  it("does not follow a redirect, so the key never reaches another host", async () => {
    const urls: string[] = [];
    const fake = (async (url: URL | string) => {
      urls.push(String(url));
      return new Response(null, { status: 307, headers: { location: "https://evil.example.com/v1/chat/completions" } });
    }) as typeof fetch;
    await expect(synthesizeAimlapi(bundle, { fetch: fake })).rejects.toThrow(/redirect/);
    expect(urls).toEqual(["https://api.aimlapi.com/v1/chat/completions"]);
  });

  it("refuses to send the key to any host other than https://api.aimlapi.com", async () => {
    const fake = vi.fn() as unknown as typeof fetch;
    for (const baseUrl of ["https://api.aimlapi.com.evil.com/v1", "https://evil.com/v1", "http://api.aimlapi.com/v1", "https://api.aimlapi.com:8443/v1", "https://x@api.aimlapi.com/v1", "https://tools.aimlapi.com/v1"]) {
      await expect(synthesizeAimlapi(bundle, { fetch: fake, baseUrl })).rejects.toThrow(/Refusing/);
    }
    expect(fake).not.toHaveBeenCalled();
    expect(assertAimlapiUrl("https://api.aimlapi.com/v1/chat/completions").hostname).toBe("api.aimlapi.com");
  });

  it("is listed as an engine and is available only when AIMLAPI_API_KEY is set", async () => {
    let aiml = (await detectEngines()).find(e => e.id === "aimlapi");
    expect(aiml).toMatchObject({ label: "AI/ML API", available: true });
    vi.stubEnv("AIMLAPI_API_KEY", "");
    aiml = (await detectEngines()).find(e => e.id === "aimlapi");
    expect(aiml).toMatchObject({ available: false, detail: "set AIMLAPI_API_KEY" });
  }, 20_000);
});
