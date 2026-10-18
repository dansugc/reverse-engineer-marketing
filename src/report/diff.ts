// What changed between two runs of the same company — the marketing version of
// REA's compare_application_versions. Competitive monitoring: run REM weekly,
// diff, see new ads, killed ads, audience growth, repositioning.
import { channelLabel } from "./markdown.js";
import type { EvidenceBundle } from "../index.js";

type Num = number | null;

function metric(b: EvidenceBundle, source: string, titleStart: string | null, key: string): Num {
  const e = b.evidence.find(x => x.source === source && (!titleStart || x.title.startsWith(titleStart)));
  const v = (e?.data as any)?.[key];
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

const METRICS: [string, string, string | null, string][] = [
  ["Meta ads in library", "meta_ads", null, "totalInLibrary"],
  ["Meta ads live now", "meta_ads", null, "activeNow"],
  ["Meta ads launched in last 30d", "meta_ads", null, "launchedLast30d"],
  ["Google ads (estimate)", "google_ads", null, "estimate"],
  ["Apple Search Ads (EU, last year)", "apple_ads", "Apple Search Ads: ", "totalAdsLastYear"],
  ["TikTok followers", "tiktok", null, "followers"],
  ["TikTok posts / week", "tiktok", null, "postsPerWeek"],
  ["Instagram followers", "instagram", null, "followers"],
  ["X followers", "x", null, "followers"],
  ["YouTube subscribers", "youtube", null, "subscribers"],
  ["LinkedIn followers", "linkedin", null, "followers"],
  ["Indexed URLs (sitemap)", "seo", "Sitemap", "totalUrls"],
  ["Content updates (90d)", "seo", "Sitemap", "blogPostsLast90d"],
  ["App Store ratings", "appstore", "App Store", "ratingCount"],
];

export interface RunDiff {
  from: { generatedAt: string; harness: string };
  to: { generatedAt: string; harness: string };
  brand: string;
  metrics: { name: string; before: Num; after: Num; delta: Num }[];
  channels: { channel: string; before: string; after: string }[];
  positioning: { before?: string; after?: string } | null;
  content: { platform: string; added: { title?: string; text?: string; url: string; date?: string }[]; removed: number }[];
}

export function diffRuns(a: EvidenceBundle, b: EvidenceBundle): RunDiff {
  const [older, newer] = a.generatedAt <= b.generatedAt ? [a, b] : [b, a];
  const metrics = METRICS.map(([name, src, title, key]) => {
    const before = metric(older, src, title, key);
    const after = metric(newer, src, title, key);
    return { name, before, after, delta: before != null && after != null ? Math.round((after - before) * 100) / 100 : null };
  }).filter(m => m.before != null || m.after != null);

  const card = (x: EvidenceBundle) => Object.fromEntries(x.scorecard.map(c => [c.channel, `${c.status} ${c.strength}/3`]));
  const ca = card(older);
  const cb = card(newer);
  const channels = Object.keys({ ...ca, ...cb })
    .filter(k => ca[k] !== cb[k])
    .map(k => ({ channel: channelLabel(k), before: ca[k] ?? "—", after: cb[k] ?? "—" }));

  const pitch = (x: EvidenceBundle) => {
    const d = x.evidence.find(e => e.source === "website" && e.title.startsWith("Homepage positioning"))?.data as any;
    return d ? String(d.h1?.[0] ?? d.title ?? "") : undefined;
  };
  const pa = pitch(older);
  const pb = pitch(newer);

  const ids = new Set((older.content ?? []).map(c => c.id));
  const newIds = new Set((newer.content ?? []).map(c => c.id));
  const platforms = [...new Set([...(older.content ?? []), ...(newer.content ?? [])].map(c => c.platform))];
  const content = platforms
    .map(p => ({
      platform: p,
      added: (newer.content ?? []).filter(c => c.platform === p && !ids.has(c.id)).map(c => ({ title: c.title, text: c.text?.slice(0, 160), url: c.url, date: c.date })),
      removed: (older.content ?? []).filter(c => c.platform === p && !newIds.has(c.id)).length,
    }))
    .filter(x => x.added.length || x.removed);

  return {
    from: { generatedAt: older.generatedAt, harness: older.harness.sha },
    to: { generatedAt: newer.generatedAt, harness: newer.harness.sha },
    brand: newer.brand,
    metrics,
    channels,
    positioning: pa !== pb ? { before: pa, after: pb } : null,
    content,
  };
}

const fmt = (n: Num) => (n == null ? "—" : n.toLocaleString("en-US"));

export function renderDiff(d: RunDiff): string {
  const lines = [
    `# What changed at ${d.brand}`,
    "",
    `${d.from.generatedAt.slice(0, 10)} → ${d.to.generatedAt.slice(0, 10)}`,
    "",
    "## Numbers",
    "",
    "| Metric | Before | After | Change |",
    "|---|---|---|---|",
    ...d.metrics.map(m => `| ${m.name} | ${fmt(m.before)} | ${fmt(m.after)} | ${m.delta == null ? "—" : `${m.delta > 0 ? "+" : ""}${fmt(m.delta)}`} |`),
  ];
  if (d.channels.length) lines.push("", "## Channel changes", "", ...d.channels.map(c => `- **${c.channel}**: ${c.before} → ${c.after}`));
  if (d.positioning) lines.push("", "## Positioning", "", `- before: "${d.positioning.before ?? "—"}"`, `- after: "${d.positioning.after ?? "—"}"`);
  if (d.content.length) {
    lines.push("", "## New and stopped posts/ads (in the collected samples)");
    for (const c of d.content) {
      lines.push("", `### ${c.platform}: ${c.added.length} new, ${c.removed} no longer seen`);
      for (const a of c.added.slice(0, 8)) lines.push(`- ${a.date ?? ""} ${a.title ?? a.text ?? ""} — <${a.url}>`.trim());
    }
  }
  if (lines.length < 10) lines.push("", "_No measurable changes._");
  lines.push("", "_Samples differ between runs; \"no longer seen\" means not in the newer sample, not necessarily deleted._");
  return lines.join("\n");
}
