import { cached } from "../http.js";

const BASE = "https://api.scrapecreators.com";

/**
 * Thin Scrape Creators client with a hard credit budget. Every call costs ~1
 * credit, so collectors ask `can()` before optional calls and the run reports
 * how many were spent.
 */
export class ScrapeCreators {
  spent = 0;
  constructor(
    private readonly apiKey: string,
    readonly budget: number,
  ) {}

  can(n = 1): boolean {
    return this.spent + n <= this.budget;
  }

  async get<T = any>(path: string, params: Record<string, string | number | undefined>): Promise<T | null> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
    const url = `${BASE}${path}?${qs}`;
    return cached(`sc:${url}`, async () => {
      if (!this.can()) throw new Error(`Scrape Creators credit budget (${this.budget}) reached`);
      this.spent++;
      const res = await fetch(url, { headers: { "x-api-key": this.apiKey }, signal: AbortSignal.timeout(45_000) });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || json?.success === false) {
        const msg = json?.message || json?.error || `HTTP ${res.status}`;
        throw new Error(`scrapecreators ${path}: ${msg}`);
      }
      return json as T;
    });
  }
}

export function scrapeCreatorsFromEnv(budget: number): ScrapeCreators | null {
  const key = process.env.SCRAPECREATORS_API_KEY || process.env.SCRAPE_CREATORS_API_KEY;
  return key ? new ScrapeCreators(key, budget) : null;
}
