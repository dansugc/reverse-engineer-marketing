// Brand identity: logo candidates and founder hints from free sources
// (Wikidata here; website JSON-LD/text in website.ts). Founders are merged
// and enriched in people.ts.
import type { Ctx, FounderHint } from "../context.js";
import { fetchJson } from "../http.js";
import { sameSite } from "../target.js";
import type { LogoCandidate } from "./html.js";

const WD = "https://www.wikidata.org/w/api.php";
// Wikimedia asks API clients for a descriptive User-Agent.
const WD_HEADERS = { "user-agent": "reverse-engineer-marketing/0.1 (https://github.com/dansugc/reverse-engineer-marketing)" };

type Claims = Record<string, { mainsnak: { datavalue?: { value: any } } }[]>;
const vals = (c: Claims | undefined, p: string): any[] => (c?.[p] ?? []).map(x => x.mainsnak.datavalue?.value).filter(v => v != null);
const ids = (c: Claims | undefined, p: string): string[] => vals(c, p).map(v => v?.id).filter(Boolean);

async function entities(qids: string[]): Promise<Record<string, { labels?: any; claims?: Claims; descriptions?: any }>> {
  if (!qids.length) return {};
  const { json } = await fetchJson<any>(`${WD}?action=wbgetentities&ids=${qids.slice(0, 50).join("|")}&props=claims|labels|descriptions&languages=en&format=json`, { headers: WD_HEADERS });
  return json?.entities ?? {};
}

/** Finds the Wikidata item whose official website is this domain (product → developer org for founders). */
export async function collectWikidata(ctx: Ctx): Promise<void> {
  const { target, found, store } = ctx;
  const brand = found.brandName ?? target.brand;
  if (!brand || !target.domain) return;
  const domains = [target.domain, ...(target.aliases ?? [])];
  const { json } = await fetchJson<any>(`${WD}?action=wbsearchentities&search=${encodeURIComponent(brand)}&language=en&format=json&limit=8&type=item`, { headers: WD_HEADERS });
  const cands = ((json?.search ?? []) as any[]).map(r => r.id as string);
  const ents = await entities(cands);
  const match = cands.map(id => ({ id, e: ents[id] })).find(({ e }) => vals(e?.claims, "P856").some(u => typeof u === "string" && domains.some(d => sameSite(u, d))));
  if (!match?.e) return;

  // Products point at their developer / owner; founders live on the org item.
  let org = match;
  const parentIds = [...ids(match.e.claims, "P178"), ...ids(match.e.claims, "P127"), ...ids(match.e.claims, "P749")];
  if (!ids(match.e.claims, "P112").length && parentIds.length) {
    const parents = await entities(parentIds.slice(0, 3));
    const withFounders = parentIds.map(id => ({ id, e: parents[id] })).find(x => ids(x.e?.claims, "P112").length);
    if (withFounders?.e) org = withFounders;
  }
  const founderIds = ids(org.e!.claims, "P112");
  const ceoIds = ids(org.e!.claims, "P169");
  const people = await entities([...new Set([...founderIds, ...ceoIds])]);
  const label = (id: string) => people[id]?.labels?.en?.value as string | undefined;

  const founders = founderIds.map(id => {
    const c = people[id]?.claims;
    return {
      name: label(id),
      role: ceoIds.includes(id) ? "Founder & CEO" : "Founder",
      x: vals(c, "P2002")[0] as string | undefined,
      linkedin: vals(c, "P6634")[0] ? `https://www.linkedin.com/in/${vals(c, "P6634")[0]}` : undefined,
      photo: vals(c, "P18")[0] ? commons(vals(c, "P18")[0], 256) : undefined,
      wikidata: `https://www.wikidata.org/wiki/${id}`,
    };
  }).filter(f => f.name);
  const ceos = ceoIds.filter(id => !founderIds.includes(id)).map(id => ({ name: label(id), role: "CEO" })).filter(f => f.name);

  for (const f of [...founders, ...ceos]) found.founderHints.push({ name: f.name!, role: f.role, source: "wikidata", url: (f as any).wikidata, linkedin: (f as any).linkedin, x: (f as any).x, photo: (f as any).photo });
  const logo = vals(match.e.claims, "P154")[0] ?? vals(org.e!.claims, "P154")[0];
  if (logo) found.logos.push({ url: commons(logo, 256), source: "wikidata" });
  const xHandle = vals(match.e.claims, "P2002")[0];
  if (xHandle && !found.socials.x) found.socials.x = xHandle;

  const inception = String(vals(org.e!.claims, "P571")[0]?.time ?? vals(match.e.claims, "P571")[0]?.time ?? "").slice(1, 5);
  store.add({
    source: "wikidata",
    kind: "observation",
    title: `Wikidata: ${org.e!.labels?.en?.value ?? brand}${inception ? `, founded ${inception}` : ""}${founders.length ? ` by ${founders.map(f => f.name).join(", ")}` : ""}${ceos.length ? `; CEO ${ceos.map(c => c.name).join(", ")}` : ""}`,
    url: `https://www.wikidata.org/wiki/${org.id}`,
    data: { item: match.id, organization: org.id !== match.id ? org.id : undefined, description: org.e!.descriptions?.en?.value, inception: inception || undefined, founders, ceos, logo: logo ? commons(logo, 256) : undefined },
  });
}

function commons(file: string, width: number): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

const LOGO_RANK: LogoCandidate["source"][] = ["apple-touch-icon", "linkedin", "appstore", "jsonld", "icon", "instagram", "wikidata", "og-image", "favicon"];

/** Best-first logo list; the UI falls through on load errors. Square marks beat banners. */
export function rankLogos(logos: LogoCandidate[], domain?: string): LogoCandidate[] {
  const all = [...logos];
  if (domain) all.push({ url: `https://www.google.com/s2/favicons?sz=128&domain=${domain}`, source: "favicon", size: 128 });
  const seen = new Set<string>();
  return all
    .filter(l => !seen.has(l.url) && seen.add(l.url))
    .sort((a, b) => LOGO_RANK.indexOf(a.source) - LOGO_RANK.indexOf(b.source) || (b.size ?? 0) - (a.size ?? 0))
    .filter(l => l.source !== "icon" || (l.size ?? 0) >= 96 || /\.svg(\?|$)/i.test(l.url) || !all.some(x => x.source !== "icon" && x.source !== "favicon" && x.source !== "og-image"));
}

export function addHint(found: Ctx["found"], hint: FounderHint): void {
  found.founderHints.push(hint);
}
