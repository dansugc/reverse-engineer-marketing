// Deterministic channel scorecard: no LLM, every row cites evidence ids.
// The LLM (or your agent) interprets; this decides what was actually observed.
import { CHANNELS, type Channel, type Evidence, type EvidenceStore } from "../evidence.js";

export type Status = "active" | "likely" | "dormant" | "none" | "unknown";

export interface ChannelScore {
  channel: Channel;
  status: Status;
  /** 0–3: how much this channel looks like a growth engine for them. */
  strength: 0 | 1 | 2 | 3;
  signal: string;
  evidence: string[];
}

const d = (e: Evidence | undefined) => (e?.data ?? {}) as any;

export function scorecard(store: EvidenceStore): ChannelScore[] {
  const tracking = store.find("tracking", "Ad/attribution pixels") ?? store.find("tracking", "No ad pixels");
  const stack = store.find("tracking", "Marketing stack");
  const pixels: any[] = d(tracking).pixels ?? [];
  const tags: any[] = d(stack).tags ?? [];
  const has = (id: string) => pixels.some(p => p.id === id) || tags.some(t => t.id === id);
  const unknown = (c: Channel) => store.unknowns.find(u => u.channel === c);
  const out = new Map<Channel, ChannelScore>();
  const set = (channel: Channel, status: Status, strength: number, signal: string, ev: (Evidence | undefined)[]) =>
    out.set(channel, { channel, status, strength: Math.max(0, Math.min(3, strength)) as ChannelScore["strength"], signal, evidence: ev.filter(Boolean).map(e => e!.id) });

  // Paid ------------------------------------------------------------------
  const meta = store.bySource("meta_ads")[0];
  if (meta) {
    const m = d(meta);
    const a = Number(m.activeNow ?? m.activeInSample ?? 0);
    const total = Number(m.totalInLibrary ?? 0);
    const longest = m.longestRunning?.[0]?.runningDays ?? m.longestRunningActive?.[0]?.runningDays ?? 0;
    if (a > 0) set("paid_meta", "active", a >= 30 ? 3 : a >= 8 ? 2 : 1, `${a} active now, ${total} in library, ${m.launchedLast30d} new in 30d; longest ran ${longest}d`, [meta]);
    else if (total > 0) set("paid_meta", "dormant", total >= 30 ? 2 : 1, `${total} ads in library, all paused (last ran ${m.lastRan ?? "?"}); longest ran ${longest}d`, [meta]);
    else set("paid_meta", "none", 0, "Meta page found, no ads in library", [meta]);
  } else pixelOnly("paid_meta", "meta_pixel", "Meta Pixel installed");

  const google = store.bySource("google_ads")[0];
  if (google) {
    const g = d(google);
    set("paid_google", g.shownLast30d > 0 ? "active" : g.estimate > 0 ? "dormant" : "none", g.estimate >= 50 ? 3 : g.estimate >= 10 ? 2 : g.estimate > 0 ? 1 : 0, `~${g.estimate} ads, ${g.shownLast30d} shown in last 30d`, [google]);
  } else pixelOnly("paid_google", "google_ads", "Google Ads conversion tag installed");

  const li = store.bySource("linkedin_ads")[0];
  const liSample = d(li).sample?.length ?? 0;
  if (li && liSample) set("paid_linkedin", "active", liSample >= 10 ? 2 : 1, `${liSample} ads by them in library sample`, [li]);
  else pixelOnly("paid_linkedin", "linkedin_insight", "LinkedIn Insight Tag installed", li);

  pixelOnly("paid_tiktok", "tiktok_pixel", "TikTok Pixel installed");
  pixelOnly("paid_reddit", "reddit_pixel", "Reddit Pixel installed");

  function pixelOnly(channel: Channel, pixel: string, label: string, ev?: Evidence) {
    if (has(pixel)) set(channel, "likely", 1, `${label} (no ad-library confirmation)`, [tracking, ev]);
    else if (ev) set(channel, "none", 0, "No ads found and no pixel", [ev, tracking]);
    else set(channel, "unknown", 0, unknown(channel)?.reason ?? "Not checked", [tracking]);
  }

  // Organic social ----------------------------------------------------------
  const social = (channel: Channel, source: "tiktok" | "instagram" | "x", reachKey: string) => {
    const e = store.bySource(source)[0];
    if (!e) return set(channel, "unknown", 0, unknown(channel)?.reason ?? "No account found", []);
    const x = d(e);
    const followers = Number(x.followers ?? 0);
    const reach = Number(x[reachKey] ?? 0);
    const cadence = Number(x.postsPerWeek ?? 0);
    const dormant = x.lastPostDaysAgo != null && x.lastPostDaysAgo > 45;
    const strength = dormant ? 0 : (followers >= 100_000 || reach >= 50_000 ? 3 : followers >= 10_000 || reach >= 5_000 ? 2 : cadence >= 1 ? 1 : 0);
    set(channel, dormant ? "dormant" : cadence > 0 ? "active" : "none", strength, e.title.replace(/^[^:]+:\s*/, ""), [e]);
  };
  social("organic_tiktok", "tiktok", "medianViewsRecent");
  social("organic_instagram", "instagram", "medianLikes");
  social("organic_x", "x", "medianViews");

  const yt = store.bySource("youtube")[0];
  if (yt) {
    const subs = Number(d(yt).subscribers ?? 0);
    set("organic_youtube", subs > 0 ? "active" : "none", subs >= 100_000 ? 3 : subs >= 10_000 ? 2 : subs > 500 ? 1 : 0, yt.title.replace(/^[^:]+:\s*/, ""), [yt]);
  } else set("organic_youtube", "unknown", 0, unknown("organic_youtube")?.reason ?? "No channel found", []);

  const lic = store.bySource("linkedin")[0];
  if (lic) {
    const x = d(lic);
    const recent = (x.recentPosts ?? []).filter((p: any) => p.date && Date.now() - Date.parse(p.date) < 30 * 86_400_000).length;
    set("organic_linkedin", recent ? "active" : "dormant", x.followers >= 100_000 ? 3 : x.followers >= 10_000 ? 2 : recent ? 1 : 0, `${x.followers?.toLocaleString?.("en-US") ?? "?"} followers, ${recent} posts in last 30d (sample)`, [lic]);
  } else set("organic_linkedin", "unknown", 0, unknown("organic_linkedin")?.reason ?? "No company page found", []);

  // SEO / GEO ---------------------------------------------------------------
  const sm = store.find("seo", "Sitemap") ?? store.find("seo", "No readable sitemap");
  const top = store.find("seo", "Top Google results");
  if (sm) {
    const s = d(sm);
    const fams = (s.sections ?? []).filter((x: any) => x.programmatic).length;
    const total = s.totalUrls ?? 0;
    const strength = fams && total >= 1000 ? 3 : (s.blogPostsLast90d ?? 0) >= 6 || total >= 300 ? 2 : total >= 30 ? 1 : 0;
    set("seo", strength ? "active" : "none", strength, `${total} indexed URLs, ${fams} programmatic families, ${s.blogPostsLast90d ?? 0} content updates/90d`, [sm, top]);
  } else set("seo", "unknown", 0, "SEO source failed", []);

  const geo = store.find("seo", "AI-search stance");
  if (geo) {
    const g = d(geo);
    const blocked = Object.entries(g.robots?.aiBots ?? {}).filter(([, v]) => v === "blocked").map(([k]) => k);
    set("geo", g.llmsTxt ? "active" : "none", g.llmsTxt ? 1 : 0, `${g.llmsTxt ? "llms.txt published" : "no llms.txt"}${blocked.length ? `; blocks ${blocked.join(", ")}` : ""}`, [geo]);
  }

  // People / community / launches --------------------------------------------
  const fo = store.bySource("founders")[0];
  if (fo) {
    const list: any[] = Array.isArray(fo.data) ? (fo.data as any[]) : [];
    const checked = list.some(f => f.linkedinFollowers != null || f.x?.followers != null);
    const best = Math.max(0, ...list.map(f => Math.max(Number(f.linkedinFollowers ?? 0), Number(f.x?.followers ?? 0))));
    const posting = list.some(f => f.postsRecently);
    const names = list.slice(0, 3).map(f => f.name).join(", ");
    if (!list.length) set("founder_led", "unknown", 0, "No founder names found", [fo]);
    else if (!checked) set("founder_led", "unknown", 0, `Founders: ${names} (audience not checked)`, [fo]);
    else set("founder_led", posting ? "active" : best ? "dormant" : "none", best >= 25_000 && posting ? 3 : best >= 5_000 && posting ? 2 : posting ? 1 : 0, fo.title.replace(/^[^:]+:\s*/, ""), [fo]);
  } else set("founder_led", "unknown", 0, unknown("founder_led")?.reason ?? "Not checked", []);

  const rm = store.find("reddit", "Reddit marketing");
  const rmen = store.find("reddit", "Reddit mentions");
  const rseo = store.find("reddit", "Reddit threads ranking");
  if (rm) {
    const x = d(rm);
    const affiliated = (x.affiliatedPosts?.length ?? 0) + (x.affiliatedComments?.length ?? 0);
    const wau = Number(x.ownSubreddit?.weeklyActive ?? 0);
    const owned = Boolean(x.ownSubreddit?.linkedFromSite) || /brand-named/.test(x.ownSubreddit?.note ?? "");
    const strength = affiliated >= 5 || (owned && wau >= 5_000) ? 3 : affiliated >= 2 || (owned && wau >= 500) ? 2 : affiliated || owned ? 1 : 0;
    set("reddit_marketing", strength ? "active" : has("reddit_pixel") ? "likely" : "none", strength || (has("reddit_pixel") ? 1 : 0), `${affiliated} brand/founder posts+replies${owned ? `, r/${x.ownSubreddit.name} ${wau.toLocaleString("en-US")} weekly active` : ""}${has("reddit_pixel") ? ", Reddit pixel" : ""}`, [rm, rseo, tracking]);
  } else set("reddit_marketing", has("reddit_pixel") ? "likely" : "unknown", has("reddit_pixel") ? 1 : 0, unknown("reddit_marketing")?.reason ?? "Not checked", [tracking]);

  if (rmen) {
    const x = d(rmen);
    const threads: any[] = x.topThreads ?? [];
    const hot = threads.filter(t => t.score >= 50).length;
    const ranking = (d(rseo) as any[]).length ?? 0;
    set("community", threads.length ? "active" : "none", hot >= 3 || ranking >= 5 ? 2 : threads.length >= 3 ? 1 : 0, `${rmen.title.replace(/^Reddit mentions:\s*/, "")}${ranking ? `; ${ranking} Reddit threads rank on Google` : ""}`, [rmen, rseo]);
  } else set("community", "unknown", 0, unknown("community")?.reason ?? "Not checked", []);

  const hn = store.bySource("hackernews")[0];
  const ph = store.bySource("producthunt")[0];
  const best = Math.max(0, ...((d(hn) as any[]).map?.(x => x.points ?? 0) ?? [0]));
  const launched = best > 0 || ph || has("producthunt_badge");
  set("launches", launched ? "active" : "none", best >= 300 ? 3 : best >= 100 || ph ? 2 : launched ? 1 : 0, [hn?.title, ph?.title].filter(Boolean).join("; ") || "No HN/PH footprint", [hn, ph]);

  const app = store.bySource("appstore");
  if (app.length) {
    const ratings = Math.max(0, ...app.map(a => Number(d(a).ratingCount ?? 0)));
    set("app_store", "active", ratings >= 10_000 ? 3 : ratings >= 1_000 ? 2 : 1, app.map(a => a.title).join("; "), app);
  } else set("app_store", "none", 0, "No App Store / Play app found", []);

  // Funnel motion -------------------------------------------------------------
  const email = tags.filter(t => t.category === "email");
  set("lifecycle", email.length ? "active" : "unknown", email.length ? 1 : 0, email.length ? `Email/lifecycle tools: ${email.map(t => t.name).join(", ")}` : "No email tool visible client-side (most run server-side)", [stack]);

  const affPage = store.find("website", "Affiliate / partner program");
  const affTags = tags.filter(t => t.category === "affiliate");
  set("affiliate", affPage || affTags.length ? "active" : "none", affPage && affTags.length ? 2 : affPage || affTags.length ? 1 : 0, [affPage && `program page${d(affPage).commission ? ` (${d(affPage).commission})` : ""}`, affTags.length && `tracked via ${affTags.map(t => t.name).join(", ")}`].filter(Boolean).join("; ") || "No affiliate program found", [affPage, stack]);

  const demo = store.find("website", "Demo / contact-sales");
  const money = store.find("website", "Monetization");
  const salesTags = tags.filter(t => t.implies === "sales_led");
  const contact = Boolean(d(money).contactSales);
  const salesScore = (demo ? 1 : 0) + (salesTags.length ? 1 : 0) + (contact ? 1 : 0);
  set("sales_led", salesScore ? "active" : "none", salesScore, [demo && "demo page", contact && "contact-sales tier", salesTags.length && `${salesTags.map(t => t.name).join(", ")}`].filter(Boolean).join("; ") || "Self-serve only", [demo, money, stack]);

  return CHANNELS.map(c => out.get(c) ?? { channel: c, status: "unknown" as const, strength: 0 as const, signal: "Not checked", evidence: [] });
}

/** The 1–3 channels doing the heavy lifting, strongest first. */
export function engines(card: ChannelScore[]): ChannelScore[] {
  return card.filter(c => c.strength >= 2 && (c.status === "active" || c.status === "likely")).sort((a, b) => b.strength - a.strength).slice(0, 4);
}
