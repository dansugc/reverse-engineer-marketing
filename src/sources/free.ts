// Key-free sources: Wayback Machine positioning history, App Store, Hacker News.
import type { Ctx } from "../context.js";
import { clip, fetchJson, fetchText } from "../http.js";
import { sameSite } from "../target.js";
import { pageFacts } from "./html.js";

/** How the homepage pitch changed over time — pivots and repositioning are pure alpha. */
export async function collectWayback(ctx: Ctx): Promise<void> {
  const { target, store } = ctx;
  if (!target.domain) throw new Error("no domain");
  const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target.domain)}&output=json&fl=timestamp,statuscode&filter=statuscode:200&collapse=timestamp:6&limit=400`;
  const { json } = await fetchJson<string[][]>(cdx, { timeoutMs: 25_000 });
  const rows = (json ?? []).slice(1).map(r => r[0]!).filter(Boolean);
  if (!rows.length) {
    store.unknown({ channel: "positioning_history", reason: "No Wayback Machine snapshots", manualCheck: `https://web.archive.org/web/*/${target.domain}` });
    return;
  }
  // Oldest, ~2y, ~1y, ~6mo ago, latest.
  const pick = new Set<string>([rows[0]!, rows[rows.length - 1]!]);
  for (const monthsBack of [24, 12, 6]) {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsBack);
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    const hit = rows.find(ts => ts.slice(0, 6) >= ym);
    if (hit) pick.add(hit);
  }
  const snaps = await Promise.allSettled(
    [...pick].sort().map(async ts => {
      const r = await fetchText(`https://web.archive.org/web/${ts}id_/https://${target.domain}/`, { timeoutMs: 20_000 });
      const f = pageFacts(r.body, `https://${target.domain}/`);
      return { date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`, title: clip(f.title, 140), h1: clip(f.h1[0], 160), description: clip(f.description, 220), ctas: f.ctas.slice(0, 4) };
    }),
  );
  const history = snaps.flatMap(s => (s.status === "fulfilled" ? [s.value] : []));
  store.add({
    source: "wayback",
    kind: "observation",
    title: `Homepage history: first archived ${history[0]?.date ?? rows[0]!.slice(0, 4)}, ${rows.length} monthly snapshots`,
    url: `https://web.archive.org/web/*/${target.domain}`,
    data: { firstSeen: rows[0], monthlySnapshots: rows.length, history },
  });
}

export async function collectAppStore(ctx: Ctx): Promise<void> {
  const { target, store, found } = ctx;
  let ids = [...new Set([target.appleId, ...found.appStoreIds].filter(Boolean) as string[])];
  // No app link on the site? Look the brand up and keep only apps whose seller URL is this domain.
  if (!ids.length && found.brandName && target.domain) {
    const { json } = await fetchJson<any>(`https://itunes.apple.com/search?entity=software&limit=10&term=${encodeURIComponent(found.brandName)}`);
    ids = (json?.results ?? []).filter((r: any) => r.sellerUrl && sameSite(r.sellerUrl, target.domain!)).map((r: any) => String(r.trackId));
  }
  if (!ids.length) {
    await collectPlay(ctx);
    return;
  }
  const { json } = await fetchJson<any>(`https://itunes.apple.com/lookup?id=${ids.slice(0, 3).join(",")}`);
  for (const a of json?.results ?? []) {
    if (!target.url && a.sellerUrl) {
      try {
        const u = new URL(a.sellerUrl);
        target.url = u.origin;
        target.domain = u.hostname.replace(/^www\./, "");
      } catch {
        // ignore
      }
    }
    if (!target.brand) target.brand = a.trackName;
    if (a.artworkUrl512) found.logos.push({ url: a.artworkUrl512, source: "appstore", size: 512 });
    // Indie apps are often published under the founder's own name.
    if (a.sellerName && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(a.sellerName)) found.founderHints.push({ name: a.sellerName, role: "App Store seller", source: "appstore_seller", url: a.trackViewUrl });
    store.add({
      source: "appstore",
      kind: "observation",
      title: `App Store: ${a.trackName} — ${Number(a.userRatingCount ?? 0).toLocaleString("en-US")} ratings, ${a.averageUserRating?.toFixed?.(2) ?? "?"}★`,
      url: a.trackViewUrl,
      data: {
        appId: String(a.trackId),
        name: a.trackName,
        seller: a.sellerName,
        sellerUrl: a.sellerUrl,
        genres: a.genres,
        price: a.formattedPrice,
        ratingCount: a.userRatingCount,
        rating: a.averageUserRating,
        firstReleased: a.releaseDate,
        lastUpdated: a.currentVersionReleaseDate,
        version: a.version,
        releaseNotes: clip(a.releaseNotes, 500),
        description: clip(a.description, 1500),
        screenshots: (a.screenshotUrls ?? []).length,
        contentRating: a.contentAdvisoryRating,
      },
    });
  }
  await collectPlay(ctx);
}

async function collectPlay(ctx: Ctx): Promise<void> {
  const id = ctx.target.playId ?? ctx.found.playIds[0];
  if (!id) return;
  const r = await fetchText(`https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}&hl=en_US`, { timeoutMs: 15_000 }).catch(() => null);
  if (!r || r.status !== 200) return;
  const installs = r.body.match(/>([\d.,]+[KMB]?\+)<\/div><div[^>]*>Downloads/i)?.[1] ?? r.body.match(/"([\d,]+\+)"/)?.[1];
  const f = pageFacts(r.body, r.finalUrl);
  ctx.store.add({ source: "appstore", kind: "observation", title: `Google Play: ${clip(f.title.replace(/ - Apps on Google Play$/, ""), 60)}${installs ? ` — ${installs} downloads` : ""}`, url: r.finalUrl, data: { installs, description: clip(f.description, 600) } });
}

export async function collectHackerNews(ctx: Ctx): Promise<void> {
  const { target, store } = ctx;
  if (!target.domain) return;
  const { json } = await fetchJson<any>(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(target.domain)}&restrictSearchableAttributes=url&hitsPerPage=30`);
  const hits = (json?.hits ?? []) as any[];
  if (!hits.length) {
    store.add({ source: "hackernews", kind: "observation", title: "No Hacker News submissions of the domain", url: `https://hn.algolia.com/?query=${target.domain}`, data: [] });
    return;
  }
  const top = hits
    .map(h => ({ title: h.title, points: h.points ?? 0, comments: h.num_comments ?? 0, date: h.created_at?.slice(0, 10), showHN: /^show hn/i.test(h.title ?? ""), url: `https://news.ycombinator.com/item?id=${h.objectID}` }))
    .sort((a, b) => b.points - a.points);
  store.add({
    source: "hackernews",
    kind: "observation",
    title: `Hacker News: ${json.nbHits} submissions, best ${top[0]!.points} points${top.some(t => t.showHN) ? ", has Show HN launch" : ""}`,
    url: `https://hn.algolia.com/?query=${target.domain}`,
    data: top.slice(0, 8),
  });
}
