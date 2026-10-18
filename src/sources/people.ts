// Founders (founder-led distribution is the most under-copied channel) and
// community footprint (Reddit, Product Hunt).
import type { Ctx } from "../context.js";
import { clip, daysAgo } from "../http.js";

const FOUNDER = /\b(co-?founder|founder|ceo|chief executive)\b/i;

export async function collectFounders(ctx: Ctx): Promise<void> {
  const { store, found, target } = ctx;
  const brand = found.brandName ?? target.brand ?? "";
  if (!ctx.sc) {
    store.unknown({ channel: "founder_led", reason: "SCRAPECREATORS_API_KEY not set — founder discovery skipped", manualCheck: `https://www.google.com/search?q=${encodeURIComponent(`"${brand}" founder site:linkedin.com/in`)}` });
    return;
  }
  const sc = ctx.sc;
  const res = await sc.get<any>("/v1/google/search", { query: `"${brand}" (founder OR co-founder OR CEO) site:linkedin.com/in` });
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidates = ((res?.results ?? []) as any[])
    .filter(r => /linkedin\.com\/in\//.test(r.url) && FOUNDER.test(`${r.title} ${r.description}`) && norm(`${r.title} ${r.description}`).includes(norm(brand)))
    .map(r => ({ name: clip(String(r.title).split(/\s[-–|]\s/)[0], 60), headline: clip(r.title, 120), url: String(r.url).split("?")[0]!, snippet: clip(r.description, 200) }));
  // linkedin.com/in links on the site are usually founders too.
  for (const url of found.people) if (!candidates.some(c => c.url.includes(url.split("/in/")[1]!))) candidates.push({ name: url.split("/in/")[1]!, headline: "linked from company site", url, snippet: "" });

  const founders: any[] = [];
  for (const c of candidates.slice(0, 3)) {
    if (!sc.can(2)) break;
    const p = await sc.get<any>("/v1/linkedin/profile", { url: c.url }).catch(() => null);
    const posts = ((p?.recentPosts ?? []) as any[]).map(x => ({ date: x.datePublished?.slice(0, 10), title: clip(x.title, 160), url: x.link }));
    const lastPost = posts[0]?.date ? daysAgo(Date.parse(posts[0].date) / 1000) : null;
    founders.push({
      ...c,
      name: p?.name ?? c.name,
      linkedinFollowers: p?.followers ?? null,
      location: p?.location,
      recentPosts: posts.slice(0, 5),
      articles: ((p?.articles ?? []) as any[]).slice(0, 3).map(a => ({ headline: a.headline, date: a.datePublished?.slice(0, 10), url: a.url })),
      postsRecently: lastPost !== null && lastPost <= 30,
    });
  }
  // One X lookup for the most likely founder: founder-led X is a common B2B/indie engine.
  const lead = founders[0];
  if (lead && sc.can(2)) {
    const xs = await sc.get<any>("/v1/google/search", { query: `"${lead.name}" ${brand} site:x.com` }).catch(() => null);
    const hit = ((xs?.results ?? []) as any[]).map(r => String(r.url).match(/x\.com\/([A-Za-z0-9_]{2,15})(?:[/?]|$)/)?.[1]).find(h => h && !/^(i|home|search|intent)$/i.test(h));
    if (hit) {
      const prof = await sc.get<any>("/v1/twitter/profile", { handle: hit }).catch(() => null);
      lead.x = { handle: hit, followers: prof?.legacy?.followers_count ?? null, bio: clip(prof?.legacy?.description, 200), url: `https://x.com/${hit}` };
    }
  }
  store.add({
    source: "founders",
    kind: founders.length ? "observation" : "derivation",
    title: founders.length
      ? `Founders/leaders: ${founders.map(f => `${f.name}${f.linkedinFollowers ? ` (${f.linkedinFollowers.toLocaleString("en-US")} LI followers${f.postsRecently ? ", posting" : ""})` : ""}${f.x?.followers ? `, X ${f.x.followers.toLocaleString("en-US")}` : ""}`).join("; ")}`
      : "No founder profiles found via search",
    url: `https://www.google.com/search?q=${encodeURIComponent(`"${brand}" founder site:linkedin.com/in`)}`,
    data: founders,
  });
}

export async function collectCommunity(ctx: Ctx): Promise<void> {
  const { store, found, target } = ctx;
  const brand = found.brandName ?? target.brand ?? "";
  if (!ctx.sc) {
    store.unknown({ channel: "community", reason: "SCRAPECREATORS_API_KEY not set — Reddit/Product Hunt skipped", manualCheck: `https://www.reddit.com/search/?q=${encodeURIComponent(target.domain ?? brand)}` });
    return;
  }
  const [reddit, ph] = await Promise.all([
    ctx.sc.get<any>("/v1/reddit/search", { query: target.domain ?? brand }).catch(() => null),
    ctx.sc.can(2) ? ctx.sc.get<any>("/v1/google/search", { query: `site:producthunt.com/products ${brand}` }).catch(() => null) : null,
  ]);
  const posts = ((reddit?.posts ?? []) as any[]).map(p => ({ subreddit: p.subreddit, title: clip(p.title, 160), score: p.score ?? 0, comments: p.num_comments ?? 0, date: p.created_at_iso?.slice(0, 10), author: p.author, url: p.url }));
  const subs: Record<string, number> = {};
  for (const p of posts) subs[p.subreddit] = (subs[p.subreddit] ?? 0) + 1;
  store.add({
    source: "reddit",
    kind: "observation",
    title: `Reddit: ${posts.length} recent threads mention ${target.domain ?? brand}${posts.length ? ` (top r/${Object.entries(subs).sort((a, b) => b[1] - a[1])[0]![0]})` : ""}`,
    url: `https://www.reddit.com/search/?q=${encodeURIComponent(target.domain ?? brand)}`,
    data: { subreddits: subs, threads: posts.sort((a, b) => b.score - a.score).slice(0, 8), ownSubreddit: found.socials.reddit },
  });
  const n = (x: unknown) => String(x ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  // Search is fuzzy ("Cal AI" also returns Cal.com): keep pages whose slug or title contains the brand.
  const phHits = ((ph?.results ?? []) as any[]).filter(r => /producthunt\.com\/products\//.test(r.url) && (n(String(r.url).split("/products/")[1]).includes(n(brand)) || n(String(r.title).split(/[:|-]/)[0]) === n(brand))).slice(0, 3);
  if (phHits.length || found.socials.producthunt)
    store.add({ source: "producthunt", kind: "observation", title: `Product Hunt presence: ${phHits.map(r => clip(r.title, 60)).join("; ") || found.socials.producthunt}`, url: phHits[0]?.url ?? `https://www.producthunt.com/products/${found.socials.producthunt}`, data: phHits.map(r => ({ title: r.title, url: r.url, snippet: clip(r.description, 200) })) });
}
