import { scorecard, type ChannelScore } from "./analyze/scorecard.js";
import { runSource, skip, type Ctx } from "./context.js";
import { EvidenceStore, type Evidence, type SourceRun, type Unknown } from "./evidence.js";
import { loadHarness } from "./harness.js";
import { collectAppStore, collectHackerNews, collectWayback } from "./sources/free.js";
import { collectPaid } from "./sources/paid.js";
import { collectCommunity, collectFounders } from "./sources/people.js";
import { scrapeCreatorsFromEnv } from "./sources/scrapecreators.js";
import { collectSeo } from "./sources/seo.js";
import { collectSocial } from "./sources/social.js";
import { collectWebsite } from "./sources/website.js";
import { parseTarget, type Target } from "./target.js";

export type Area = "website" | "seo" | "history" | "apps" | "paid" | "social" | "founders" | "community";
export const AREAS: Area[] = ["website", "seo", "history", "apps", "paid", "social", "founders", "community"];

/** runSource labels that belong to each area (for stage error reporting). */
const RUN_LABELS: Record<Area, string[]> = {
  website: ["website"],
  seo: ["seo"],
  history: ["wayback"],
  apps: ["appstore", "hackernews"],
  paid: ["paid"],
  social: ["social"],
  founders: ["founders"],
  community: ["community"],
};

export interface RunOptions {
  /** Limit to some areas (website always runs: it discovers handles for the rest). */
  only?: Area[];
  maxCredits?: number;
  /** Override discovered handles, e.g. { tiktok: "notionhq" }. */
  handles?: Ctx["found"]["socials"];
  log?: (msg: string) => void;
  /** Structured progress for UIs: website first, then the areas in parallel. */
  onStage?: (stage: "website" | Area, state: "start" | "done" | "error", detail?: string) => void;
}

export interface EvidenceBundle {
  tool: { name: "reverse-engineer-marketing"; version: string };
  harness: { version: string; sha: string };
  target: Target;
  generatedAt: string;
  brand: string;
  discovered: Ctx["found"];
  scorecard: ChannelScore[];
  evidence: Evidence[];
  unknowns: Unknown[];
  sources: SourceRun[];
  credits: { scrapecreators: number | null };
}

export const VERSION = "0.1.0";

export async function reverseEngineer(input: string, opts: RunOptions = {}): Promise<EvidenceBundle> {
  const target = parseTarget(input);
  const store = new EvidenceStore();
  const sc = scrapeCreatorsFromEnv(opts.maxCredits ?? Number(process.env.REM_MAX_CREDITS ?? 40));
  const log = opts.log ?? (() => {});
  const ctx: Ctx = { target, store, sc, log, found: { socials: { ...opts.handles }, people: [], appStoreIds: [], playIds: [] } };
  const want = (a: Area) => !opts.only?.length || opts.only.includes(a);
  const stage = opts.onStage ?? (() => {});
  const timed = async (name: "website" | Area, labels: string[], fn: () => Promise<void>) => {
    stage(name, "start");
    const before = store.runs.length;
    await fn();
    const failed = store.runs.slice(before).filter(r => r.status === "error" && labels.includes(r.source));
    stage(name, failed.length ? "error" : "done", failed.map(f => f.reason).join("; ") || undefined);
  };

  // App-store links: resolve the developer website first, then scan it like any site.
  if (target.kind !== "website") {
    log("→ app store");
    await timed("apps", ["appstore"], () => runSource(ctx, "appstore", collectAppStore));
  }
  if (target.url) {
    log(`→ website ${target.url}`);
    await timed("website", ["website"], () => runSource(ctx, "website", collectWebsite));
  } else skip(ctx, "website", "no website found for this app");

  const jobs: [Area, string, () => Promise<void>][] = [
    ["seo", "seo", () => runSource(ctx, "seo", collectSeo)],
    ["history", "wayback", () => runSource(ctx, "wayback", collectWayback)],
    ["apps", "appstore + hacker news", async () => {
      if (target.kind === "website") await runSource(ctx, "appstore", collectAppStore);
      await runSource(ctx, "hackernews", collectHackerNews);
    }],
    ["paid", "ad libraries", () => runSource(ctx, "paid", collectPaid)],
    ["social", "social accounts", () => runSource(ctx, "social", collectSocial)],
    ["founders", "founders", () => runSource(ctx, "founders", collectFounders)],
    ["community", "community", () => runSource(ctx, "community", collectCommunity)],
  ];
  await Promise.all(
    jobs.filter(([a]) => want(a) && target.url).map(([area, label, fn]) => {
      log(`→ ${label}`);
      return timed(area, RUN_LABELS[area], fn);
    }),
  );

  const harness = loadHarness();
  return {
    tool: { name: "reverse-engineer-marketing", version: VERSION },
    harness: { version: harness.version, sha: harness.sha },
    target,
    generatedAt: new Date().toISOString(),
    brand: ctx.found.brandName ?? target.brand ?? target.domain ?? input,
    discovered: ctx.found,
    scorecard: scorecard(store),
    evidence: store.items,
    unknowns: store.unknowns,
    sources: store.runs,
    credits: { scrapecreators: sc ? sc.spent : null },
  };
}

export { parseTarget } from "./target.js";
export { renderMarkdown } from "./report/markdown.js";
export { synthesize } from "./analyze/synthesize.js";
export { validateReport } from "./report/validate.js";
export type { ChannelScore } from "./analyze/scorecard.js";
export type { Evidence, Unknown } from "./evidence.js";
