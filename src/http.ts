import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const UA =
  process.env.REM_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
}

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string>; maxBytes?: number } = {},
): Promise<FetchedPage> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml,*/*;q=0.8", ...opts.headers },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });
  let body = await res.text();
  const max = opts.maxBytes ?? 3_000_000;
  if (body.length > max) body = body.slice(0, max);
  return { url, finalUrl: res.url || url, status: res.status, contentType: res.headers.get("content-type") ?? "", body };
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<{ status: number; json: T | null }> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json", ...opts.headers },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });
  const json = (await res.json().catch(() => null)) as T | null;
  return { status: res.status, json };
}

// Small disk cache so agents re-calling tools don't re-spend paid API credits.
const CACHE_DIR = process.env.REM_CACHE_DIR || join(homedir(), ".cache", "reverse-engineer-marketing");
const TTL_MS = Number(process.env.REM_CACHE_TTL_HOURS ?? 24) * 3_600_000;

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.REM_NO_CACHE) return fn();
  const file = join(CACHE_DIR, `${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`);
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as { at: number; value: T };
    if (Date.now() - raw.at < TTL_MS) return raw.value;
  } catch {
    // miss
  }
  const value = await fn();
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // cache is best-effort
  }
  return value;
}

export function clip(s: unknown, n = 400): string {
  const t = typeof s === "string" ? s : s == null ? "" : String(s);
  const flat = t.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

export function median(xs: number[]): number | null {
  const v = xs.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : Math.round((v[m - 1]! + v[m]!) / 2);
}

/** Posts per week across a set of unix-second timestamps. */
export function perWeek(unixSeconds: number[]): number | null {
  const t = unixSeconds.filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (t.length < 2) return null;
  const spanDays = Math.max(1, (t[t.length - 1]! - t[0]!) / 86_400);
  return Math.round((t.length / spanDays) * 7 * 10) / 10;
}

export function daysAgo(unixSeconds: number): number {
  return Math.round((Date.now() / 1000 - unixSeconds) / 86_400);
}
