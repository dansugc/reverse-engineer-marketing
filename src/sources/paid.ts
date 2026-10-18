import { addContent, type Ctx } from "../context.js";
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

/** First image / video in a Meta ad snapshot (incl. carousel cards). */
export function metaMedia(snap: any): { thumb?: string; video?: string } {
  const cards: any[] = [snap ?? {}, ...((snap?.cards ?? []) as any[])];
  let thumb: string | undefined;
  let video: string | undefined;
  for (const c of cards) {
    const v = (c.videos ?? [])[0] ?? c;
    video ??= v?.video_hd_url ?? v?.video_sd_url ?? undefined;
    thumb ??= v?.video_preview_image_url ?? c.images?.[0]?.resized_image_url ?? c.images?.[0]?.original_image_url ?? c.resized_image_url ?? c.original_image_url ?? undefined;
  }
  return { thumb: thumb || undefined, video: video || undefined };
}

async function metaAds(ctx: Ctx, brand: string, manual: string): Promise<void> {
  const sc = ctx.sc!;
  const { store, found } = ctx;
  try {
    const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ig = found.socials.instagram?.toLowerCase();
    const fb = found.socials.facebook?.toLowerCase();
    const queries = [...new Set([brand, found.socials.instagram, ctx.target.domain?.split(".")[0]].filter(Boolean) as string[])];
    let page: any = null;
    let candidates: any[] = [];
    for (const q of queries.slice(0, 2)) {
      const search = await sc.get<any>("/v1/facebook/adLibrary/search/companies", { query: q });
      candidates = (search?.searchResults ?? []) as any[];
      page =
        candidates.find(p => ig && p.ig_username?.toLowerCase() === ig) ??
        candidates.find(p => fb && (p.page_alias?.toLowerCase() === fb || norm(p.page_alias) === norm(fb))) ??
        candidates.find(p => norm(p.name) === norm(brand)) ??
        null;
      if (page) break;
    }
    if (!page) {
      store.unknown({ channel: "paid_meta", reason: `No Meta page matched "${brand}" with confidence (candidates: ${candidates.slice(0, 4).map(p => p.name).join(", ") || "none"})`, manualCheck: manual });
      return;
    }
    // status=ALL: paused/finished campaigns are strategy too (the default is ACTIVE only).
    // Three samples: most-shown ever (the winners), newest, and what's live now.
    const [winners, all, activeOnly] = await Promise.all([
      sc.get<any>("/v1/facebook/adLibrary/company/ads", { pageId: page.page_id, status: "ALL", sort_by: "total_impressions" }).catch(() => null),
      sc.get<any>("/v1/facebook/adLibrary/company/ads", { pageId: page.page_id, status: "ALL" }),
      sc.get<any>("/v1/facebook/adLibrary/company/ads", { pageId: page.page_id, status: "ACTIVE" }).catch(() => null),
    ]);
    // Second page of the full library widens the sample (the first pages often overlap).
    const page2 = all?.cursor && sc.can(4) ? await sc.get<any>("/v1/facebook/adLibrary/company/ads", { pageId: page.page_id, status: "ALL", cursor: all.cursor }).catch(() => null) : null;
    const topIds = new Set(((winners?.results ?? []) as any[]).slice(0, 10).map(a => a.ad_archive_id));
    const seen = new Set<string>();
    const ads = ([...(winners?.results ?? []), ...(all?.results ?? []), ...(page2?.results ?? []), ...(activeOnly?.results ?? [])] as any[]).filter(a => a?.ad_archive_id && !seen.has(a.ad_archive_id) && seen.add(a.ad_archive_id));

    const total = Number(all?.searchResultsCount ?? ads.length);
    const activeTotal = Number(activeOnly?.searchResultsCount ?? ads.filter(a => a.is_active).length);
    const now = Date.now() / 1000;
    const ranDays = (a: any) => (a.start_date ? Math.max(1, Math.round(((a.is_active || !a.end_date ? now : a.end_date) - a.start_date) / 86_400)) : 0);
    const links = (a: any) => [a.snapshot?.link_url, ...(a.snapshot?.extra_links ?? [])];
    const view = (a: any) => ({
      runningDays: ranDays(a),
      active: Boolean(a.is_active),
      started: a.start_date_string?.slice(0, 10),
      ended: a.is_active ? undefined : a.end_date_string?.slice(0, 10),
      format: a.snapshot?.display_format,
      variants: a.collation_count ?? 1,
      title: clip(a.snapshot?.title ?? a.snapshot?.cards?.[0]?.title, 140),
      body: clip(a.snapshot?.body?.text ?? a.snapshot?.cards?.[0]?.body, 400),
      cta: a.snapshot?.cta_text,
      landing: a.snapshot?.link_url,
      hasVideo: Boolean(metaMedia(a.snapshot).video),
      url: a.url,
    });
    const lastRan = ads.map(a => (a.is_active ? now : a.end_date ?? 0)).reduce((m, x) => Math.max(m, x), 0);
    const e = store.add({
      source: "meta_ads",
      kind: "observation",
      title: `Meta ads: ${total} ads in library, ${activeTotal} active now${activeTotal === 0 && total ? ` (paused — last ran ${new Date(lastRan * 1000).toISOString().slice(0, 10)})` : ""}, ${ads.filter(a => a.start_date && daysAgo(a.start_date) <= 30).length} launched in last 30d (sample of ${ads.length})`,
      url: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${page.page_id}`,
      data: {
        page: { id: page.page_id, name: page.name, likes: page.likes, igUsername: page.ig_username, igFollowers: page.ig_followers },
        totalInLibrary: total,
        activeNow: activeTotal,
        sampled: ads.length,
        activeInSample: ads.filter(a => a.is_active).length,
        lastRan: lastRan ? new Date(lastRan * 1000).toISOString().slice(0, 10) : null,
        launchedLast30d: ads.filter(a => a.start_date && daysAgo(a.start_date) <= 30).length,
        formats: tally(ads.map(a => a.snapshot?.display_format)),
        ctas: tally(ads.map(a => a.snapshot?.cta_text)),
        platforms: tally(ads.flatMap(a => a.publisher_platform ?? [])),
        landingPages: tally(ads.flatMap(links).map(landingKey).filter(Boolean) as string[]),
        utmCampaigns: tally(ads.flatMap(links).map(u => utm(u, "utm_campaign")).filter(Boolean) as string[]),
        // Ads that ran longest (active or paused) are the proven winners.
        longestRunning: [...ads].sort((x, y) => ranDays(y) - ranDays(x)).slice(0, 8).map(view),
        longestRunningActive: ads.filter(a => a.is_active).sort((x, y) => ranDays(y) - ranDays(x)).slice(0, 5).map(view),
        mostShown: ((winners?.results ?? []) as any[]).slice(0, 8).map(view),
        newest: [...ads].sort((x, y) => (y.start_date ?? 0) - (x.start_date ?? 0)).slice(0, 5).map(view),
      },
    });
    addContent(
      ctx,
      ads.map(a => {
        const v = view(a);
        const m = metaMedia(a.snapshot);
        return {
          id: `meta:${a.ad_archive_id}`,
          platform: "meta_ads" as const,
          kind: "ad" as const,
          url: a.url ?? `https://www.facebook.com/ads/library/?id=${a.ad_archive_id}`,
          title: v.title || undefined,
          text: v.body || undefined,
          thumb: m.thumb,
          video: m.video,
          author: a.page_name,
          date: v.started,
          status: a.is_active ? ("active" as const) : ("inactive" as const),
          metrics: { runningDays: v.runningDays, variants: v.variants },
          tags: [topIds.has(a.ad_archive_id) ? "top by impressions" : "", v.runningDays >= 60 ? "proven (60d+)" : "", v.format, v.cta].filter(Boolean) as string[],
        };
      }),
      e.id,
    );
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
    const ge = store.add({
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
    addContent(ctx, ads.map(a => ({ id: `google:${a.creativeId}`, platform: "google_ads" as const, kind: "ad" as const, url: a.adUrl, title: `${a.format ?? "ad"} by ${a.advertiserName ?? "?"}`, thumb: a.imageUrl, author: a.advertiserName, date: a.firstShown?.slice(0, 10), status: Date.now() - Date.parse(a.lastShown) < 30 * 86_400_000 ? ("active" as const) : ("inactive" as const), tags: [a.format].filter(Boolean) })), ge.id);
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
    const le = store.add({
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
    addContent(ctx, ads.map(a => ({ id: `liad:${a.id}`, platform: "linkedin_ads" as const, kind: "ad" as const, url: a.url, title: clip(a.headline, 140) || undefined, text: clip(a.description, 500) || undefined, thumb: a.image ?? a.imageSources?.[0] ?? a.thumbnailSources?.[0], video: a.videoSources?.[0], author: a.advertiser, date: a.startDate ?? undefined, tags: [a.adType, a.cta].filter(Boolean) })), le.id);
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
