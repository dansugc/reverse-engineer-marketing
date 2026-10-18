// Reddit marketing: is the company (or its founders) working Reddit on purpose?
// Signals: brand/founder accounts posting or replying, launch/"I built" posts,
// an owned subreddit, comparison threads they show up in, and Reddit threads
// that rank on Google for the brand (the Reddit-SEO surface).
import { addContent, type Ctx } from "../context.js";
import { clip } from "../http.js";

const SELF_PROMO = /\b(?:i|we) (?:just )?(?:built|made|created|launched|developed|shipped)\b|\bmy (?:app|startup|tool|side ?project|product|saas)\b|\bfeedback on my\b|\bshow ?off\b/i;
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const brandRe = (brand: string) => brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]?");

/**
 * Brand/founder-affiliated = username contains the brand or a founder's surname,
 * or the text ties the author to *this* brand ("I built Cal AI", "founder of Linear",
 * "Notion team here", "disclosure: … Cal AI"). Generic "I made…" is not enough.
 */
export function affiliated(text: string, author: string, brand: string, founderKeys: string[] = []): boolean {
  const a = norm(author);
  if (norm(brand).length >= 4 && a.includes(norm(brand))) return true;
  if (founderKeys.some(k => k.length >= 5 && a.includes(k))) return true;
  const b = brandRe(brand);
  return [
    new RegExp(`\\b(?:i|we)(?: just| finally| recently)? (?:built|made|created|launched|developed|shipped|run|started|founded) ${b}\\b`, "i"),
    new RegExp(`\\b(?:co-?founder|founder|ceo|dev|developer|maker|creator|team) (?:of|at|behind|from) ${b}\\b`, "i"),
    new RegExp(`\\b${b} (?:co-?founder|founder|dev|team|ceo) here\\b`, "i"),
    new RegExp(`\\b(?:disclaimer|disclosure|full transparency)\\b[^.]{0,100}\\b${b}\\b|\\b${b}\\b[^.]{0,100}\\b(?:disclaimer|disclosure)\\b`, "i"),
  ].some(re => re.test(text));
}
const COMPARISON = /\bvs\.?\b|\bversus\b|alternative|better than|switch(?:ed|ing)? (?:from|to)|compared? to|instead of/i;
const ASK = /recommend|suggestions?|best .{0,30}(?:app|tool|software)|looking for|which .{0,20}should|anyone (?:use|tried)/i;

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  author: string;
  score: number;
  comments: number;
  date?: string;
  url: string;
  selfPromo: boolean;
  affiliated: boolean;
  comparison: boolean;
}

/** Word-boundary brand match so "Cal AI" doesn't match "local airport". */
export function mentions(text: string, brand: string, domain?: string): boolean {
  const t = text.toLowerCase();
  if (domain && t.includes(domain.toLowerCase())) return true;
  return new RegExp(`(^|[^a-z0-9])${brandRe(brand.toLowerCase())}([^a-z0-9]|$)`).test(t);
}

export function classifyPost(p: any, brand: string, domain?: string, founderKeys: string[] = []): RedditPost | null {
  const text = `${p.title ?? ""}\n${p.selftext ?? ""}`;
  if (!mentions(text, brand, domain)) return null;
  const selfPromo = SELF_PROMO.test(text);
  return {
    id: p.id,
    subreddit: p.subreddit,
    title: clip(p.title, 180),
    author: p.author,
    score: p.score ?? 0,
    comments: p.num_comments ?? 0,
    date: p.created_at_iso?.slice(0, 10),
    url: p.url?.startsWith("http") ? p.url : `https://www.reddit.com${p.permalink}`,
    selfPromo,
    affiliated: affiliated(text, p.author, brand, founderKeys),
    comparison: COMPARISON.test(p.title ?? ""),
  };
}

function walkComments(list: any[], visit: (c: any) => void, depth = 0): void {
  if (!Array.isArray(list) || depth > 6) return;
  for (const c of list) {
    if (!c || typeof c !== "object") continue;
    visit(c);
    const r = c.replies;
    walkComments(Array.isArray(r) ? r : r?.items ?? r?.comments ?? r?.data?.children ?? [], visit, depth + 1);
  }
}

export async function collectReddit(ctx: Ctx): Promise<void> {
  const { store, found, target } = ctx;
  const brand = found.brandName ?? target.brand ?? target.domain ?? "";
  const domain = target.domain;
  const q = encodeURIComponent(brand);
  if (!ctx.sc) {
    store.unknown({ channel: "reddit_marketing", reason: "SCRAPECREATORS_API_KEY not set — Reddit not checked", manualCheck: `https://www.reddit.com/search/?q=${q}` });
    return;
  }
  const sc = ctx.sc;
  const ownGuess = found.socials.reddit ?? brand.replace(/[^A-Za-z0-9_]/g, "");
  const founderKeys = found.founderHints.map(h => norm(h.name.split(/\s+/).pop())).filter(k => k.length >= 5);
  const label = domain?.split(".")[0];
  const [byBrand, byDomain, top, google, sub] = await Promise.all([
    sc.get<any>("/v1/reddit/search", { query: `"${brand}"` }).catch(() => null),
    domain ? sc.get<any>("/v1/reddit/search", { query: label && norm(label) !== norm(brand) ? `${domain} OR ${label}` : domain }).catch(() => null) : null,
    sc.can(6) ? sc.get<any>("/v1/reddit/search", { query: `"${brand}"`, sort: "top", timeframe: "year" }).catch(() => null) : null,
    sc.can(6) ? sc.get<any>("/v1/google/search", { query: `site:reddit.com "${brand}"` }).catch(() => null) : null,
    ownGuess.length >= 3 && sc.can(6) ? sc.get<any>("/v1/reddit/subreddit/details", { subreddit: ownGuess }).catch(() => null) : null,
  ]);

  const seen = new Set<string>();
  const posts: RedditPost[] = [];
  for (const p of [...(byBrand?.posts ?? []), ...(byDomain?.posts ?? []), ...(top?.posts ?? [])] as any[]) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    const c = classifyPost(p, brand, domain, founderKeys);
    if (c) posts.push(c);
  }

  // Comments on the biggest threads: who mentions the brand, and is it the brand itself?
  const brandComments: { author: string; score: number; body: string; affiliated: boolean; thread: string; url?: string; date?: string }[] = [];
  const deep = [...posts].sort((a, b) => b.comments - a.comments).slice(0, 3);
  await Promise.all(
    deep.map(async t => {
      if (!sc.can(3)) return;
      const res = await sc.get<any>("/v1/reddit/post/comments", { url: t.url }).catch(() => null);
      walkComments(res?.comments ?? [], c => {
        const body = String(c.body ?? "");
        if (!mentions(body, brand, domain)) return;
        brandComments.push({ author: c.author, score: c.score ?? 0, body: clip(body, 280), affiliated: affiliated(body, c.author, brand, founderKeys), thread: t.title, url: c.url, date: c.created_at_iso?.slice(0, 10) });
      });
    }),
  );

  const subs: Record<string, number> = {};
  for (const p of posts) subs[p.subreddit] = (subs[p.subreddit] ?? 0) + 1;
  const affiliatedPosts = posts.filter(p => p.affiliated);
  const affiliatedComments = brandComments.filter(c => c.affiliated);
  const recommendations = brandComments.filter(c => !c.affiliated).sort((a, b) => b.score - a.score);

  const brandNorm = norm(brand);
  const ownSub =
    sub && sub.display_name
      ? {
          name: sub.display_name as string,
          weeklyActive: sub.weekly_active_users ?? null,
          weeklyContributions: sub.weekly_contributions ?? null,
          created: String(sub.created_at ?? "").slice(0, 10),
          description: clip(sub.description, 200),
          linkedFromSite: Boolean(found.socials.reddit),
          note: found.socials.reddit ? "linked from the company site" : String(sub.description ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(brandNorm) ? "brand-named subreddit (may be fan-run)" : "same name as the brand — may be unrelated",
        }
      : null;

  const ranking = ((google?.results ?? []) as any[])
    .filter(r => /reddit\.com\/r\//.test(r.url))
    .slice(0, 8)
    .map(r => ({ title: clip(r.title, 140), subreddit: String(r.url).match(/\/r\/([^/]+)/)?.[1], url: r.url, snippet: clip(r.description, 180) }));

  const re1 = store.add({
    source: "reddit",
    kind: "derivation",
    title: `Reddit marketing: ${affiliatedPosts.length} brand/founder posts, ${affiliatedComments.length} brand/founder replies in big threads${ownSub ? `, r/${ownSub.name} (${ownSub.weeklyActive?.toLocaleString?.("en-US") ?? "?"} weekly active, ${ownSub.note})` : ""}`,
    url: `https://www.reddit.com/search/?q=${q}`,
    data: {
      affiliatedPosts: affiliatedPosts.slice(0, 8),
      affiliatedComments: affiliatedComments.slice(0, 8),
      launchPosts: posts.filter(p => p.selfPromo).slice(0, 6),
      ownSubreddit: ownSub,
      note: "Affiliation is inferred from usernames and phrases like \"I'm the founder\" / \"we built\" — verify before citing as fact.",
    },
  });
  const re2 = store.add({
    source: "reddit",
    kind: "observation",
    title: `Reddit mentions: ${posts.length} threads naming ${brand} across ${Object.keys(subs).length} subreddits, ${posts.filter(p => p.comparison).length} comparison threads, ${recommendations.length} organic mentions in comments`,
    url: `https://www.reddit.com/search/?q=${q}`,
    data: {
      subreddits: Object.fromEntries(Object.entries(subs).sort((a, b) => b[1] - a[1]).slice(0, 12)),
      topThreads: [...posts].sort((a, b) => b.score - a.score).slice(0, 8),
      comparisonThreads: posts.filter(p => p.comparison).slice(0, 6),
      askThreads: posts.filter(p => ASK.test(p.title)).slice(0, 6),
      organicMentions: recommendations.slice(0, 8),
    },
  });
  addContent(ctx, posts.filter(p => p.affiliated).map(p => threadItem(p, ["brand/founder post"])), re1.id);
  addContent(ctx, affiliatedComments.map((c, i) => ({ id: `rc:${c.url ?? i}`, platform: "reddit" as const, kind: "comment" as const, url: c.url ?? "", text: c.body, author: `u/${c.author}`, date: c.date, metrics: { score: c.score }, tags: ["brand/founder reply"], title: `in: ${c.thread}` })), re1.id);
  addContent(ctx, [...posts].sort((a, b) => b.score - a.score).map(p => threadItem(p, [p.comparison ? "comparison" : "", ASK.test(p.title) ? "asks for recommendations" : ""].filter(Boolean))), re2.id);
  addContent(ctx, recommendations.slice(0, 10).map((c, i) => ({ id: `rc:${c.url ?? `m${i}`}`, platform: "reddit" as const, kind: "comment" as const, url: c.url ?? "", text: c.body, author: `u/${c.author}`, date: c.date, metrics: { score: c.score }, tags: ["organic mention"], title: `in: ${c.thread}` })), re2.id);
  if (ranking.length) {
    const re3 = store.add({ source: "reddit", kind: "observation", title: `Reddit threads ranking on Google for "${brand}": ${ranking.length} (top: ${ranking[0]!.title})`, url: `https://www.google.com/search?q=${encodeURIComponent(`site:reddit.com "${brand}"`)}`, data: ranking });
    addContent(ctx, ranking.map(r => ({ id: `reddit:${String(r.url).match(/comments\/([a-z0-9]+)/)?.[1] ?? r.url}`, platform: "reddit" as const, kind: "thread" as const, url: r.url, title: r.title, text: r.snippet || undefined, author: r.subreddit ? `r/${r.subreddit}` : undefined, tags: ["ranks on Google"] })), re3.id);
  }
}

function threadItem(p: RedditPost, tags: string[]) {
  return { id: `reddit:${p.id}`, platform: "reddit" as const, kind: "thread" as const, url: p.url, title: p.title, author: `u/${p.author} · r/${p.subreddit}`, date: p.date, metrics: { score: p.score, comments: p.comments }, tags };
}
