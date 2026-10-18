import type { Ctx } from "../context.js";
import { clip, fetchText } from "../http.js";
import { brandFromDomain } from "../target.js";
import { extractAppIds, extractFounderNames, extractPeople, extractSocials, extractUtms, pageFacts, pickKeyPages, pricingSignals, visibleText } from "./html.js";
import { detectTags, mergeTags, type DetectedTag } from "./tracking.js";

const PROOF = [
  /trusted by [^.]{3,60}/i,
  /(?:over|more than|\d[\d,.]*\+?)\s?(?:k|m|million|thousand)?\s?(?:users|customers|teams|companies|creators|founders|downloads|people)[^.]{0,40}/i,
  /as (?:seen|featured) (?:on|in)[^.]{0,80}/i,
  /#1 product of the (?:day|week|month)/i,
  /backed by [^.]{3,60}/i,
  /\d(?:\.\d)?\s?(?:stars?|★)[^.]{0,40}(?:reviews|ratings)/i,
];

export async function collectWebsite(ctx: Ctx): Promise<void> {
  const { target, store } = ctx;
  if (!target.url) throw new Error("no website URL for this target");

  const home = await fetchText(target.url);
  if (home.status >= 400) throw new Error(`homepage returned HTTP ${home.status}`);
  const finalUrl = home.finalUrl;
  // Follow the redirect: ads, SEO and history should look at the domain they actually use.
  const finalHost = new URL(finalUrl).hostname.replace(/^www\./, "").toLowerCase();
  if (target.domain && finalHost !== target.domain && !finalHost.endsWith(`.${target.domain}`)) {
    target.aliases = [...new Set([...(target.aliases ?? []), target.domain])];
    target.domain = finalHost;
    target.url = new URL(finalUrl).origin;
  }
  const facts = pageFacts(home.body, finalUrl);
  const text = visibleText(home.body);

  // Brand name: og:site_name > JSON-LD Organization name > first title segment.
  const titleBrand = facts.title.split(/\s[|–—:-]\s/)[0]?.trim();
  // The way the site itself writes the domain label ("DansUGC", not "Dansugc") beats our guess.
  const label = target.domain!.split(".")[0]!;
  const written = `${facts.title} ${facts.siteName ?? ""} ${facts.description} ${text.slice(0, 4000)}`.match(new RegExp(`(?<![A-Za-z0-9])${label.replace(/[^a-z0-9-]/gi, "")}(?![A-Za-z0-9])`, "i"))?.[0];
  ctx.found.brandName = facts.siteName || (titleBrand && titleBrand.length <= 30 ? titleBrand : undefined) || (written && /[A-Z]/.test(written) ? written : undefined) || target.brand || brandFromDomain(target.domain!);
  target.brand = ctx.found.brandName;

  ctx.found.logos.push(...facts.logos);
  for (const f of facts.jsonLdFounders) ctx.found.founderHints.push({ name: f.name, role: f.role, source: "jsonld", url: finalUrl, linkedin: f.url?.includes("linkedin.com/in/") ? f.url : undefined });
  for (const f of extractFounderNames(text, ctx.found.brandName)) ctx.found.founderHints.push({ ...f, source: "website_text", url: finalUrl });

  const allLinks = [...facts.links, ...facts.sameAs];
  ctx.found.socials = { ...extractSocials(allLinks), ...ctx.found.socials };
  ctx.found.people = [...new Set([...ctx.found.people, ...extractPeople(allLinks)])];
  const apps = extractAppIds(allLinks);
  ctx.found.appStoreIds = [...new Set([...ctx.found.appStoreIds, ...apps.apple])];
  ctx.found.playIds = [...new Set([...ctx.found.playIds, ...apps.play])];

  store.add({
    source: "website",
    kind: "observation",
    title: `Homepage positioning: "${clip(facts.h1[0] || facts.title, 120)}"`,
    url: finalUrl,
    data: {
      title: facts.title,
      metaDescription: facts.description,
      h1: facts.h1,
      h2: facts.h2,
      ctas: facts.ctas,
      lang: facts.lang,
      wordCount: facts.wordCount,
      socialProof: PROOF.map(re => text.match(re)?.[0]).filter(Boolean).map(s => clip(s, 120)),
      rating: facts.rating,
      jsonLdTypes: facts.jsonLdTypes,
    },
  });

  store.add({
    source: "website",
    kind: "observation",
    title: `Linked channels: ${Object.keys(ctx.found.socials).join(", ") || "none found"}`,
    url: finalUrl,
    data: { socials: ctx.found.socials, people: ctx.found.people, appStoreIds: ctx.found.appStoreIds, playIds: ctx.found.playIds },
  });

  const utms = extractUtms(facts.links);
  if (utms.length)
    store.add({ source: "website", kind: "observation", title: `${utms.length} tagged links (utm/ref) on homepage`, url: finalUrl, data: utms });

  // Tracking: page HTML + GTM containers (pixels are often only loaded via GTM).
  let tags = detectTags(home.body);
  const gtmIds = tags.find(t => t.id === "gtm")?.ids ?? [];
  const containers = await Promise.allSettled(
    gtmIds.slice(0, 2).map(async id => {
      const r = await fetchText(`https://www.googletagmanager.com/gtm.js?id=${id}`, { timeoutMs: 12_000 });
      return r.status === 200 ? detectTags(r.body, id).filter(t => t.id !== "gtm") : [];
    }),
  );
  tags = mergeTags(tags, ...containers.flatMap(c => (c.status === "fulfilled" ? [c.value] : [])));
  addTracking(ctx, tags, finalUrl, gtmIds);

  // Key pages: pricing / about / affiliate / demo tell monetization + motion.
  const keyPages = pickKeyPages(finalUrl, facts.links);
  store.add({ source: "website", kind: "observation", title: `Key pages found: ${Object.keys(keyPages).join(", ") || "none"}`, url: finalUrl, data: keyPages });

  const wanted = (["pricing", "about", "affiliate", "demo"] as const).filter(k => keyPages[k]);
  const pages = await Promise.allSettled(wanted.map(k => fetchText(keyPages[k]!, { timeoutMs: 12_000 })));
  let pricingText = /pricing|plans/i.test(finalUrl) ? text : "";
  pages.forEach((p, i) => {
    const kind = wanted[i]!;
    if (p.status !== "fulfilled" || p.value.status >= 400) return;
    const html = p.value.body;
    const pf = pageFacts(html, p.value.finalUrl);
    const body = visibleText(html);
    if (kind === "pricing") pricingText = body;
    if (kind === "about") {
      ctx.found.people = [...new Set([...ctx.found.people, ...extractPeople(pf.links)])];
      for (const f of pf.jsonLdFounders) ctx.found.founderHints.push({ name: f.name, role: f.role, source: "jsonld", url: p.value.finalUrl });
      for (const f of extractFounderNames(body, ctx.found.brandName)) ctx.found.founderHints.push({ ...f, source: "website_text", url: p.value.finalUrl });
      store.add({ source: "website", kind: "observation", title: "About/team page", url: p.value.finalUrl, data: { h1: pf.h1, h2: pf.h2, excerpt: clip(body, 1200), linkedinPeople: extractPeople(pf.links) } });
    }
    if (kind === "affiliate")
      store.add({ source: "website", kind: "observation", title: "Affiliate / partner program page exists", url: p.value.finalUrl, data: { h1: pf.h1, h2: pf.h2, excerpt: clip(body, 800), commission: body.match(/\d{1,2}\s?%[^.]{0,60}(?:commission|recurring|lifetime|revenue)/i)?.[0] } });
    if (kind === "demo")
      store.add({ source: "website", kind: "observation", title: "Demo / contact-sales page exists", url: p.value.finalUrl, data: { h1: pf.h1, ctas: pf.ctas } });
  });

  const pricing = pricingSignals(pricingText || text);
  store.add({
    source: "website",
    kind: "derivation",
    title: `Monetization: ${describePricing(pricing)}`,
    url: keyPages.pricing ?? finalUrl,
    data: { ...pricing, pricingPageFound: Boolean(keyPages.pricing) },
  });
}

function addTracking(ctx: Ctx, tags: DetectedTag[], url: string, gtmIds: string[]): void {
  const pixels = tags.filter(t => t.category === "ads_pixel" || t.category === "attribution");
  ctx.store.add({
    source: "tracking",
    kind: "observation",
    title: pixels.length ? `Ad/attribution pixels: ${pixels.map(p => p.name).join(", ")}` : "No ad pixels detected on homepage (or loaded server-side)",
    url,
    data: { pixels, gtmContainersScanned: gtmIds.slice(0, 2) },
  });
  const rest = tags.filter(t => !pixels.includes(t));
  if (rest.length) {
    const byCat: Record<string, string[]> = {};
    for (const t of rest) (byCat[t.category] ??= []).push(t.name + (t.ids.length ? ` (${t.ids.join(", ")})` : ""));
    ctx.store.add({ source: "tracking", kind: "observation", title: `Marketing stack: ${rest.map(t => t.name).join(", ")}`, url, data: { byCategory: byCat, tags: rest } });
  }
}

function describePricing(p: ReturnType<typeof pricingSignals>): string {
  const bits: string[] = [];
  if (p.freePlan) bits.push("free plan");
  if (p.freeTrial) bits.push(p.trialDays ? `${p.trialDays}-day trial` : "free trial");
  if (p.prices.length) bits.push(`prices ${p.prices.slice(0, 4).join(", ")}`);
  if (p.perSeat) bits.push("per seat");
  if (p.usageBased) bits.push("usage/credits");
  if (p.lifetimeDeal) bits.push("lifetime deal");
  if (p.contactSales) bits.push("sales-assisted tier");
  return bits.join(" · ") || "no public pricing found";
}
