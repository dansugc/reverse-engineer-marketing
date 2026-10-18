import type { Ctx } from "../context.js";
import { clip, daysAgo } from "../http.js";

export function adLibraryLinks(brand: string, domain?: string) {
  const q = encodeURIComponent(brand);
  return {
    meta: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${q}&search_type=keyword_unordered`,
    google: domain ? `https://adstransparency.google.com/?region=anywhere&domain=${domain}` : `https://adstransparency.google.com/?region=anywhere`,
    linkedin: `https://www.linkedin.com/ad-library/search?accountOwner=${q}`,
    tiktok: `https://library.tiktok.com/ads?region=all&adv_name=${q}`,
    tiktokTopAds: `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en`,
    reddit: `https://www.reddit.com/search/?q=${q}`,
    x: `https://ads.x.com/ads-repository`,
  };
}

export async function collectPaid(ctx: Ctx): Promise<void> {
  const { store, target, found } = ctx;
  const brand = found.brandName ?? target.brand ?? target.domain ?? "";
  const links = adLibraryLinks(brand, target.domain);
  // No public ad API for these; the pixel (see tracking) is the best free signal.
  store.unknown({ channel: "paid_tiktok", reason: "TikTok has no global ad library API; check the EU library / Creative Center by hand (TikTok pixel presence is reported under tracking)", manualCheck: links.tiktok });
  store.unknown({ channel: "paid_reddit", reason: "Reddit's ad library was shut down; Reddit pixel presence (tracking) is the only signal", manualCheck: links.reddit });

  if (!ctx.sc) {
    store.unknown({ channel: "paid_meta", reason: "SCRAPECREATORS_API_KEY not set", manualCheck: links.meta });
    store.unknown({ channel: "paid_google", reason: "SCRAPECREATORS_API_KEY not set", manualCheck: links.google });
    store.unknown({ channel: "paid_linkedin", reason: "SCRAPECREATORS_API_KEY not set", manualCheck: links.linkedin });
    return;
  }
  await Promise.allSettled([metaAds(ctx, brand, links.meta), googleAds(ctx, links.google), linkedinAds(ctx, brand, links.linkedin)]);
}

async function metaAds(ctx: Ctx, brand: string, manual: string): Promise<void> {
  const sc = ctx.sc!;
  const { store, found } = ctx;
  try {
    const search = await sc.get<any>("/v1/facebook/adLibrary/search/companies", { query: brand });
    const pages = (search?.searchResults ?? []) as any[];
    const ig = found.socials.instagram?.toLowerCase();
    const fb = found.socials.facebook?.toLowerCase();
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const page =
      pages.find(p => ig && p.ig_username?.toLowerCase() === ig) ??
      pages.find(p => fb && p.page_alias?.toLowerCase() === fb) ??
      pages.find(p => norm(p.name ?? "") === norm(brand)) ??
      null;
    if (!page) {
      store.unknown({ channel: "paid_meta", reason: `No Meta page matched "${brand}" with confidence (candidates: ${pages.slice(0, 4).map(p => p.name).join(", ") || "none"})`, manualCheck: manual });
      return;
    }
    const first = await sc.get<any>("/v1/facebook/adLibrary/company/ads", { pageId: page.page_id });
    let ads = (first?.results ?? []) as any[];
    if (first?.cursor && sc.can(3)) {
      const more = await sc.get<any>("/v1/facebook/adLibrary/company/ads", { pageId: page.page_id, cursor: first.cursor }).catch(() => null);
      ads = ads.concat(more?.results ?? []);
    }
    const total = Number(first?.searchResultsCount ?? ads.length);
    const active = ads.filter(a => a.is_active);
    const formats = tally(ads.map(a => a.snapshot?.display_format));
    const ctas = tally(ads.map(a => a.snapshot?.cta_text));
    const platforms = tally(ads.flatMap(a => a.publisher_platform ?? []));
    const landing = tally(ads.flatMap(a => [a.snapshot?.link_url, ...(a.snapshot?.extra_links ?? [])]).map(landingKey).filter(Boolean) as string[]);
    const utmCampaigns = tally(ads.flatMap(a => [a.snapshot?.link_url, ...(a.snapshot?.extra_links ?? [])]).map(u => utm(u, "utm_campaign")).filter(Boolean) as string[]);
    // Long-running active ads are the proven winners — nobody pays for losers for 60+ days.
    const winners = active
      .map(a => ({ a, days: a.start_date ? daysAgo(a.start_date) : 0 }))
      .sort((x, y) => y.days - x.days)
      .slice(0, 8)
      .map(({ a, days }) => ({
        runningDays: days,
        started: a.start_date_string?.slice(0, 10),
        format: a.snapshot?.display_format,
        variants: a.collation_count ?? 1,
        title: clip(a.snapshot?.title, 140),
        body: clip(a.snapshot?.body?.text ?? a.snapshot?.cards?.[0]?.body, 400),
        cta: a.snapshot?.cta_text,
        landing: a.snapshot?.link_url,
        hasVideo: Boolean(a.snapshot?.videos?.length || a.snapshot?.cards?.some((c: any) => c.video_hd_url || c.video_sd_url)),
        url: a.url,
      }));
    const newest = [...ads].sort((x, y) => (y.start_date ?? 0) - (x.start_date ?? 0)).slice(0, 5).map(a => ({ started: a.start_date_string?.slice(0, 10), format: a.snapshot?.display_format, title: clip(a.snapshot?.title, 120), body: clip(a.snapshot?.body?.text, 200), url: a.url }));
    const launchedLast30d = ads.filter(a => a.start_date && daysAgo(a.start_date) <= 30).length;
    store.add({
      source: "meta_ads",
      kind: "observation",
      title: `Meta ads: ${total} ads in library (${active.length} active in sample of ${ads.length}), ${launchedLast30d} launched in last 30d`,
      url: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${page.page_id}`,
      data: {
        page: { id: page.page_id, name: page.name, likes: page.likes, igUsername: page.ig_username, igFollowers: page.ig_followers },
        totalInLibrary: total,
        sampled: ads.length,
        activeInSample: active.length,
        launchedLast30d,
        formats,
        ctas,
        platforms,
        landingPages: landing,
        utmCampaigns,
        longestRunningActive: winners,
        newest,
      },
    });
  } catch (err) {
    store.unknown({ channel: "paid_meta", reason: errMsg(err), manualCheck: manual });
  }
}

async function googleAds(ctx: Ctx, manual: string): Promise<void> {
  const { store, target } = ctx;
  if (!target.domain) return;
  try {
    // Ads may still point at an old domain that now redirects (notion.so → notion.com).
    let domain = target.domain;
    let res = await ctx.sc!.get<any>("/v1/google/company/ads", { domain });
    for (const alias of target.aliases ?? []) {
      if ((res?.ads ?? []).length || !ctx.sc!.can(4)) break;
      domain = alias;
      res = await ctx.sc!.get<any>("/v1/google/company/ads", { domain });
    }
    const ads = (res?.ads ?? []) as any[];
    const advertisers = tally(ads.map(a => a.advertiserName));
    const lastShown = ads.map(a => Date.parse(a.lastShown)).filter(Number.isFinite);
    const recent = lastShown.filter(t => Date.now() - t < 30 * 86_400_000).length;
    store.add({
      source: "google_ads",
      kind: "observation",
      title: `Google ads: ~${res?.number_of_ads_estimate ?? ads.length} ads pointing at ${domain} (${recent} shown in last 30d), formats ${Object.keys(tally(ads.map(a => a.format))).join("/") || "n/a"}`,
      url: `https://adstransparency.google.com/?region=anywhere&domain=${domain}`,
      data: {
        domain,
        estimate: res?.number_of_ads_estimate ?? ads.length,
        formats: tally(ads.map(a => a.format)),
        advertisers,
        note: Object.keys(advertisers).length > 1 ? "Multiple advertiser names bid on this domain — check for resellers, affiliates or agencies." : undefined,
        shownLast30d: recent,
        sample: ads.slice(0, 8).map(a => ({ advertiser: a.advertiserName, format: a.format, firstShown: a.firstShown?.slice(0, 10), lastShown: a.lastShown?.slice(0, 10), url: a.adUrl, image: a.imageUrl })),
      },
    });
  } catch (err) {
    store.unknown({ channel: "paid_google", reason: errMsg(err), manualCheck: manual });
  }
}

async function linkedinAds(ctx: Ctx, brand: string, manual: string): Promise<void> {
  const { store, found } = ctx;
  try {
    const res = await ctx.sc!.get<any>("/v1/linkedin/ads/search", { company: brand });
    const all = (res?.ads ?? []) as any[];
    const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const slug = found.socials.linkedin?.toLowerCase();
    // The search is fuzzy ("Notion" also returns "Notion Studios"); keep exact advertiser matches.
    const ads = all.filter(a => norm(a.advertiser) === norm(brand) || (slug && String(a.advertiserLinkedinPage ?? "").toLowerCase().includes(slug)));
    if (!ads.length) {
      store.add({ source: "linkedin_ads", kind: "observation", title: `LinkedIn ads: none found for advertiser "${brand}"`, url: manual, data: { otherAdvertisersMatched: Object.keys(tally(all.map(a => a.advertiser))).slice(0, 8) } });
      return;
    }
    store.add({
      source: "linkedin_ads",
      kind: "observation",
      title: `LinkedIn ads: ${ads.length} ads by ${ads[0].advertiser} in first page (${res?.totalAds ?? "?"} fuzzy matches)`,
      url: manual,
      data: {
        adTypes: tally(ads.map(a => a.adType)),
        ctas: tally(ads.map(a => a.cta)),
        sample: ads.slice(0, 8).map(a => ({ headline: clip(a.headline, 140), body: clip(a.description, 300), type: a.adType, cta: a.cta, url: a.url, impressions: a.totalImpressions, targeting: a.targeting })),
      },
    });
  } catch (err) {
    store.unknown({ channel: "paid_linkedin", reason: errMsg(err), manualCheck: manual });
  }
}

export function tally(xs: unknown[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) if (typeof x === "string" && x) out[x] = (out[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 12));
}

function landingKey(u: unknown): string | null {
  if (typeof u !== "string") return null;
  try {
    const x = new URL(u);
    if (/^(fb\.me|l\.facebook\.com)$/.test(x.hostname)) return null;
    return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function utm(u: unknown, key: string): string | null {
  if (typeof u !== "string") return null;
  try {
    return new URL(u).searchParams.get(key);
  } catch {
    return null;
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
