// Apple Search Ads via Apple's public Ad Repository (EU DSA transparency).
// Free, no key: https://adrepository.apple.com — App Store ads served in EU
// countries over the last year, per app or developer.
import { addContent, type Ctx } from "../context.js";
import { clip, fetchJson } from "../http.js";
import { tally } from "./paid.js";

const API = "https://adrepository.apple.com/api/v1";
const PAGE = 50;
const MAX_PAGES = 3;

interface Ad {
  adId: string;
  appId: number;
  appName: string;
  developerId: number;
  developerName: string;
  placement: string;
  format: string;
  countryOrRegion: string;
  audienceRefinement?: Record<string, boolean | string>;
  firstImpressionDate?: string;
  lastImpressionDate?: string;
  defaultLanguageTag?: string;
  adBanner?: { subtitle?: string | null; promotionalText?: string | null; iconPictureUrl?: string | null };
  adAssets?: { videoUrl?: string | null; pictureUrl?: string | null; orientation?: string }[];
}

const day = (s?: string) => (s ? s.slice(0, 10) : undefined);
const truthy = (v: unknown) => v === true || v === "true";

async function adsFor(appId: string): Promise<{ ads: Ad[]; total: number; start?: string; end?: string }> {
  const ql = encodeURIComponent(`type==APP;id==${appId};datePreset==LAST_YEAR`);
  // NB: `offset` is a PAGE index in practice (offset=1 → rows 50–99), despite the PDF.
  const page = async (n: number) => (await fetchJson<any>(`${API}/ad-repository-ads?ql=${ql}&offset=${n}&limit=${PAGE}`, { timeoutMs: 25_000 })).json;
  const first = await page(0);
  if (!first) return { ads: [], total: 0 };
  const total: number = first.pagination?.totalResults ?? (first.data ?? []).length;
  const lastPage = Math.max(0, Math.ceil(total / PAGE) - 1);
  // Newest first: sample the start, middle and end of the year so timing and message changes show.
  const extra = [...new Set([Math.floor(lastPage / 2), lastPage])].filter(n => n > 0).slice(0, MAX_PAGES - 1);
  // Sequential with one retry: parallel page requests get dropped by the repository.
  const rest: any[] = [];
  for (const n of extra) rest.push((await page(n).catch(() => null)) ?? (await page(n).catch(() => null)));
  const seen = new Set<string>();
  const ads = [first, ...rest].flatMap(j => ((j?.data ?? []) as Ad[])).filter(a => !seen.has(a.adId) && seen.add(a.adId));
  return { ads, total, start: day(first.dataStartDate), end: day(first.dataEndDate) };
}

export async function collectAppleAds(ctx: Ctx): Promise<void> {
  const { store, found, target } = ctx;
  const appIds = [...new Set([target.appleId, ...found.appStoreIds, ...store.bySource("appstore").map(e => String((e.data as any)?.appId ?? ""))].filter(Boolean) as string[])].slice(0, 2);
  const manual = "https://adrepository.apple.com/";
  if (!appIds.length) {
    store.unknown({ channel: "paid_apple", reason: "No iOS app found for this company, so Apple Search Ads were not checked", manualCheck: manual });
    return;
  }
  const brand = found.brandName ?? target.brand ?? "";
  for (const appId of appIds) {
    const { ads, total, start, end } = await adsFor(appId);
    if (!total) {
      store.add({ source: "apple_ads", kind: "observation", title: `Apple Search Ads: no ads for app ${appId} in Apple's EU Ad Repository (last year)`, url: manual, data: { appId, note: "The repository covers EU countries only; ads elsewhere are not visible." } });
      continue;
    }
    const endMs = end ? Date.parse(end) : Date.now();
    const live = ads.filter(a => a.lastImpressionDate && endMs - Date.parse(a.lastImpressionDate) <= 7 * 86_400_000);
    const firsts = ads.map(a => day(a.firstImpressionDate)).filter(Boolean).sort() as string[];
    const targeting = (k: string) => ads.filter(a => truthy(a.audienceRefinement?.[k])).length;
    const name = ads[0]?.appName ?? appId;
    const e = store.add({
      source: "apple_ads",
      kind: "observation",
      title: `Apple Search Ads: ${total.toLocaleString("en-US")} App Store ads for ${name} in the EU over the last year (${live.length} of ${ads.length} sampled still serving)`,
      url: manual,
      data: {
        appId,
        appName: name,
        developer: ads[0]?.developerName,
        totalAdsLastYear: total,
        sampled: ads.length,
        liveInSample: live.length,
        window: { start, end },
        // Oldest sampled ad ≈ when they started buying App Store search in the EU (within the 1-year window).
        firstImpressionInSample: firsts[0],
        startedByMonth: tally(firsts.map(f => f.slice(0, 7))),
        countries: tally(ads.map(a => a.countryOrRegion)),
        placements: tally(ads.map(a => a.placement)),
        formats: tally(ads.map(a => a.format)),
        // Each subtitle is the message that ad shows under the app name — App Store copy testing in the open.
        messages: tally(ads.map(a => clip(a.adBanner?.subtitle ?? "", 80)).filter(Boolean)),
        promotionalTexts: tally(ads.map(a => clip(a.adBanner?.promotionalText ?? "", 120)).filter(Boolean)),
        languages: tally(ads.map(a => a.defaultLanguageTag ?? "")),
        targeting: { age: targeting("ageTarget"), gender: targeting("genderTarget"), location: targeting("locationTarget"), customerType: targeting("customerTypeTarget"), of: ads.length },
        withVideo: ads.filter(a => (a.adAssets ?? []).some(x => x.videoUrl)).length,
        note: "Apple's Ad Repository covers App Store ads served in EU countries only (DSA). Counts outside the EU are unknown.",
      },
    });
    // One card per distinct creative (first asset), newest first.
    const seen = new Set<string>();
    const cards = [...ads]
      .sort((a, b) => String(b.lastImpressionDate).localeCompare(String(a.lastImpressionDate)))
      .filter(a => {
        const k = `${a.format}|${a.adBanner?.subtitle}|${a.adAssets?.[0]?.pictureUrl ?? a.adAssets?.[0]?.videoUrl ?? ""}`;
        return !seen.has(k) && seen.add(k);
      })
      .slice(0, 16);
    addContent(
      ctx,
      cards.map(a => {
        const asset = (a.adAssets ?? []).find(x => x.pictureUrl && x.pictureUrl !== "null") ?? a.adAssets?.[0];
        const days = a.firstImpressionDate && a.lastImpressionDate ? Math.max(1, Math.round((Date.parse(a.lastImpressionDate) - Date.parse(a.firstImpressionDate)) / 86_400_000)) : undefined;
        return {
          id: `apple:${a.adId}`,
          platform: "apple_ads" as const,
          kind: "ad" as const,
          url: `https://adrepository.apple.com/`,
          title: `${a.appName} — ${a.adBanner?.subtitle ?? ""}`.replace(/ — $/, ""),
          text: `${a.format} · ${a.placement.replace("APPSTORE_", "").replace(/_/g, " ").toLowerCase()} · ${a.countryOrRegion}`,
          thumb: asset?.pictureUrl && asset.pictureUrl !== "null" ? asset.pictureUrl : a.adBanner?.iconPictureUrl ?? undefined,
          video: asset?.videoUrl ?? undefined,
          author: a.developerName,
          date: day(a.firstImpressionDate),
          status: live.includes(a) ? ("active" as const) : ("inactive" as const),
          metrics: { runningDays: days },
          tags: [a.countryOrRegion, a.format],
        };
      }),
      e.id,
    );
  }

  // Other apps advertising under a similar name (copycats, or apps bidding on the brand).
  if (brand.length >= 3) {
    const { json } = await fetchJson<any>(`${API}/ad-repository-entities?name=${encodeURIComponent(brand)}&types=APP&limit=20`, { timeoutMs: 20_000 }).catch(() => ({ json: null }));
    const others = ((json?.data ?? []) as { id: number; name: string }[]).filter(x => !appIds.includes(String(x.id)));
    if (others.length)
      store.add({
        source: "apple_ads",
        kind: "observation",
        title: `Apple Search Ads: ${others.length} other apps advertise under names like "${brand}" (copycats or brand bidders)`,
        url: manual,
        data: { apps: others.slice(0, 12).map(x => ({ appId: x.id, name: x.name, appStore: `https://apps.apple.com/app/id${x.id}` })), note: "Same-name apps running App Store ads. Whether they bid on the brand keyword is not public." },
      });
  }
}
