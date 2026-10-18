// Founders (founder-led distribution is the most under-copied channel) and
// community footprint (Reddit, Product Hunt).
import { addContent, type Ctx, type FounderHint } from "../context.js";
import { clip, daysAgo } from "../http.js";
import { extractFounderNames } from "./html.js";
import { collectWikidata } from "./identity.js";
import { collectReddit } from "./reddit.js";

const FOUNDER = /\b(co-?founder|founder|ceo|chief executive)\b/i;

/**
 * "Co-Founder & CEO at Cal AI" / "Cal AI co-founder" → true;
 * "Founder/CEO at Notion Skincare", "ML Engineering at Notion AI, ex-YC Founder" → false.
 */
export function founderOf(text: string, brand: string): boolean {
  const b = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s?");
  const role = "(?:co-?founder|founder|ceo|chief executive officer)(?:\\s*(?:&|and|,|/)\\s*(?:co-?founder|founder|ceo|cto|coo|cpo|president))?";
  const res = [new RegExp(`${role}\\s*(?:at|of|@|,|-|–|—|\\||·)?\\s*(${b})`, "gi"), new RegExp(`(${b})\\s*(?:'s\\s*)?(?:-|–|—|\\||·|,)?\\s*${role}`, "gi")];
  for (const re of res)
    for (const m of text.matchAll(re)) {
      const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 24);
      const brandEnd = re === res[0] ? after : text.slice(m.index! + m[1]!.length);
      // Reject "Notion Skincare", "Linear Health", "linear A": the brand must end there.
      if (/^[A-Za-z0-9]/.test(brandEnd) || /^ (?!LinkedIn\b|Inc\b|Labs\b)[A-Z][A-Za-z]*/.test(brandEnd)) continue;
      return true;
    }
  return false;
}
const WEIGHT: Record<FounderHint["source"], number> = { wikidata: 3, jsonld: 3, linkedin_search: 2, google_snippet: 2, website_text: 1, site_link: 1, appstore_seller: 1 };

export interface Founder {
  name: string;
  role?: string;
  confidence: "high" | "medium" | "low";
  score: number;
  sources: FounderHint["source"][];
  evidenceUrls: string[];
  linkedin?: string;
  linkedinFollowers?: number | null;
  photo?: string;
  location?: string;
  x?: { handle: string; followers: number | null; bio?: string; url: string };
  recentPosts?: { date?: string; title: string; url?: string }[];
  recentXPosts?: { id: string; text: string; views: number; likes?: number; date?: string; url: string; thumb?: string }[];
  articles?: { headline?: string; date?: string; url?: string }[];
  postsRecently?: boolean;
}

const key = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(Boolean).filter((w, i, a) => i === 0 || i === a.length - 1).join(" ");

/** Merge hints by name; more independent sources = more confidence. */
export function mergeFounders(hints: FounderHint[]): Founder[] {
  const by = new Map<string, Founder>();
  for (const h of hints) {
    const k = key(h.name);
    if (!k.includes(" ")) continue;
    const f = by.get(k) ?? { name: h.name, confidence: "low", score: 0, sources: [], evidenceUrls: [] };
    if (!f.sources.includes(h.source)) {
      f.sources.push(h.source);
      f.score += WEIGHT[h.source];
    }
    const roleRank = (r?: string) => (!r ? 0 : /ceo|chief/i.test(r) && /founder/i.test(r) ? 3 : /founder/i.test(r) ? 2 : 1);
    if (roleRank(h.role) > roleRank(f.role)) f.role = h.role;
    f.linkedin ??= h.linkedin;
    f.photo ??= h.photo;
    if (h.x && !f.x) f.x = { handle: h.x, followers: null, url: `https://x.com/${h.x}` };
    if (h.url && !f.evidenceUrls.includes(h.url)) f.evidenceUrls.push(h.url);
    by.set(k, f);
  }
  return [...by.values()]
    .map(f => ({ ...f, confidence: (f.score >= 3 ? "high" : f.score === 2 ? "medium" : "low") as Founder["confidence"] }))
    .sort((a, b) => b.score - a.score || Number(/founder/i.test(b.role ?? "")) - Number(/founder/i.test(a.role ?? "")));
}

export async function collectFounders(ctx: Ctx): Promise<void> {
  const { store, found, target } = ctx;
  const brand = found.brandName ?? target.brand ?? "";
  await collectWikidata(ctx).catch(err => ctx.log(`  ! wikidata: ${err instanceof Error ? err.message : err}`));

  const sc = ctx.sc;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (sc) {
    const [li, snip] = await Promise.all([
      sc.get<any>("/v1/google/search", { query: `"${brand}" (founder OR co-founder OR CEO) site:linkedin.com/in` }).catch(() => null),
      sc.get<any>("/v1/google/search", { query: `"${brand}" founders "founded by"` }).catch(() => null),
    ]);
    for (const r of (li?.results ?? []) as any[]) {
      if (!/linkedin\.com\/in\//.test(r.url) || !(founderOf(String(r.title), brand) || founderOf(String(r.description), brand))) continue;
      const parts = String(r.title).split(/\s[-–|]\s/);
      const role = parts.slice(1).find(p => FOUNDER.test(p));
      found.founderHints.push({ name: clip(parts[0], 60), role: clip(role, 60) || "Founder", source: "linkedin_search", linkedin: String(r.url).split("?")[0], url: String(r.url).split("?")[0] });
    }
    for (const r of (snip?.results ?? []) as any[]) {
      const text = `${r.title}. ${r.description}`;
      if (!norm(text).includes(norm(brand))) continue;
      for (const f of extractFounderNames(text, brand)) found.founderHints.push({ ...f, source: "google_snippet", url: r.url });
    }
  }
  // linkedin.com/in links on the company site: names come from the profile below.
  for (const url of found.people) found.founderHints.push({ name: url.split("/in/")[1]!.replace(/-[a-z0-9]{6,}$/i, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()), source: "site_link", linkedin: url, url: target.url });

  let founders = mergeFounders(found.founderHints).slice(0, 6);
  if (sc) {
    // Find LinkedIn for strong names that don't have one yet.
    for (const f of founders.filter(f => !f.linkedin && f.score >= 2).slice(0, 2)) {
      if (!sc.can(4)) break;
      const r = await sc.get<any>("/v1/google/search", { query: `"${f.name}" "${brand}" site:linkedin.com/in` }).catch(() => null);
      f.linkedin = ((r?.results ?? []) as any[]).map(x => String(x.url).split("?")[0]!).find(u => /linkedin\.com\/in\//.test(u));
    }
    for (const f of founders.filter(f => f.linkedin).slice(0, 3)) {
      if (!sc.can(3)) break;
      const p = await sc.get<any>("/v1/linkedin/profile", { url: f.linkedin }).catch(() => null);
      if (!p) continue;
      if (f.sources.includes("site_link") && p.name) f.name = p.name;
      const posts = ((p.recentPosts ?? []) as any[]).map(x => ({ date: x.datePublished?.slice(0, 10), title: clip(x.title, 160), url: x.link }));
      const lastPost = posts[0]?.date ? daysAgo(Date.parse(posts[0].date) / 1000) : null;
      Object.assign(f, {
        linkedinFollowers: p.followers ?? null,
        photo: f.photo ?? p.image,
        location: p.location,
        recentPosts: posts.slice(0, 5),
        articles: ((p.articles ?? []) as any[]).slice(0, 3).map((a: any) => ({ headline: a.headline, date: a.datePublished?.slice(0, 10), url: a.url })),
        postsRecently: lastPost !== null && lastPost <= 30,
      });
    }
    founders = dedupe(founders);
    // X for the top two founders (Wikidata may already have the handle); verify the profile name.
    for (const f of founders.filter(f => f.confidence !== "low").slice(0, 2)) {
      if (!sc.can(3)) break;
      let handle = f.x?.handle;
      const last = key(f.name).split(" ").pop() ?? "";
      const pickHandle = (res: any) =>
        ((res?.results ?? []) as any[])
          .map(r => String(r.url).match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{2,15})(?:[/?]|$)/)?.[1])
          .find(h => h && !/^(i|home|search|intent|hashtag|share)$/i.test(h));
      if (!handle) {
        // `site:` queries often come back empty; a plain query usually surfaces the profile.
        handle = pickHandle(await sc.get<any>("/v1/google/search", { query: `"${f.name}" (site:x.com OR site:twitter.com)` }).catch(() => null));
        if (!handle && sc.can(4)) handle = pickHandle(await sc.get<any>("/v1/google/search", { query: `${f.name} ${brand} twitter OR x.com` }).catch(() => null));
      }
      if (!handle) continue;
      const prof = await sc.get<any>("/v1/twitter/profile", { handle }).catch(() => null);
      const shown = String(prof?.core?.name ?? prof?.legacy?.name ?? "");
      // Same person if the surname is in the handle, display name or bio.
      if (prof && last && !f.x && !norm(`${handle} ${shown} ${prof?.legacy?.description ?? ""}`).includes(last)) continue;
      f.x = { handle, followers: prof?.legacy?.followers_count ?? null, bio: clip(prof?.legacy?.description, 200), url: `https://x.com/${handle}` };
    }
    // Founder posts for review: lead founder's X timeline + LinkedIn activity.
    const lead = founders[0];
    if (lead?.x?.handle && sc.can(2)) {
      const tl = await sc.get<any>("/v1/twitter/user-tweets", { handle: lead.x.handle }).catch(() => null);
      lead.recentXPosts = ((tl?.tweets ?? []) as any[]).slice(0, 20).map(t => ({
        id: String(t.rest_id),
        text: clip(t.legacy?.full_text, 400),
        views: Number(t.views?.count ?? NaN),
        likes: t.legacy?.favorite_count,
        date: t.legacy?.created_at ? new Date(t.legacy.created_at).toISOString().slice(0, 10) : undefined,
        url: t.url ?? `https://x.com/${lead.x!.handle}/status/${t.rest_id}`,
        thumb: (t.legacy?.extended_entities?.media ?? t.legacy?.entities?.media ?? [])[0]?.media_url_https,
      }));
    }
  } else {
    store.unknown({ channel: "founder_led", reason: "SCRAPECREATORS_API_KEY not set — founder names from free sources only; audience/posting not checked", manualCheck: `https://www.google.com/search?q=${encodeURIComponent(`"${brand}" founder site:linkedin.com/in`)}` });
  }

  const fmt = (f: Founder) =>
    `${f.name}${f.role ? ` (${f.role})` : ""}${f.linkedinFollowers ? ` · ${f.linkedinFollowers.toLocaleString("en-US")} LI followers${f.postsRecently ? ", posting" : ""}` : ""}${f.x?.followers ? ` · X ${f.x.followers.toLocaleString("en-US")}` : ""}${f.confidence === "low" ? " [weak match]" : ""}`;
  const fe = store.add({
    source: "founders",
    kind: "observation",
    title: founders.length ? `Founders/leaders: ${founders.slice(0, 4).map(fmt).join("; ")}` : "No founder names found",
    url: `https://www.google.com/search?q=${encodeURIComponent(`"${brand}" founder`)}`,
    data: founders.map(({ recentXPosts, ...f }) => ({ ...f, recentXPostCount: recentXPosts?.length })),
  });
  for (const f of founders) {
    addContent(ctx, (f.recentPosts ?? []).filter(p => p.url).map(p => ({ id: `lif:${p.url}`, platform: "linkedin" as const, kind: "post" as const, url: p.url!, text: p.title, author: f.name, date: p.date, tags: ["founder"] })), fe.id);
    addContent(ctx, (f.recentXPosts ?? []).map(t => ({ id: `x:${t.id}`, platform: "x" as const, kind: "post" as const, url: t.url, text: t.text, thumb: t.thumb, author: `${f.name} (@${f.x?.handle})`, date: t.date, metrics: { views: Number.isFinite(t.views) ? t.views : undefined, likes: t.likes }, tags: ["founder"] })), fe.id);
  }
}

/** A site_link profile renamed from LinkedIn can now duplicate a named hint: fold them together. */
function dedupe(list: Founder[]): Founder[] {
  const out: Founder[] = [];
  for (const f of list) {
    const same = out.find(o => key(o.name) === key(f.name) || (o.linkedin && o.linkedin === f.linkedin));
    if (!same) {
      out.push(f);
      continue;
    }
    for (const src of f.sources) if (!same.sources.includes(src)) (same.sources.push(src), (same.score += WEIGHT[src]));
    for (const [k, v] of Object.entries(f)) if ((same as any)[k] == null && v != null) (same as any)[k] = v;
    same.confidence = same.score >= 3 ? "high" : same.score === 2 ? "medium" : "low";
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function collectCommunity(ctx: Ctx): Promise<void> {
  const { store, found, target } = ctx;
  const brand = found.brandName ?? target.brand ?? "";
  if (!ctx.sc) {
    store.unknown({ channel: "community", reason: "SCRAPECREATORS_API_KEY not set — Reddit/Product Hunt skipped", manualCheck: `https://www.reddit.com/search/?q=${encodeURIComponent(target.domain ?? brand)}` });
    await collectReddit(ctx);
    return;
  }
  const [, ph] = await Promise.all([
    collectReddit(ctx).catch(err => ctx.log(`  ! reddit: ${err instanceof Error ? err.message : err}`)),
    ctx.sc.can(2) ? ctx.sc.get<any>("/v1/google/search", { query: `site:producthunt.com/products ${brand}` }).catch(() => null) : null,
  ]);
  const n = (x: unknown) => String(x ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  // Search is fuzzy ("Cal AI" also returns Cal.com): keep pages whose slug or title contains the brand.
  const phHits = ((ph?.results ?? []) as any[]).filter(r => /producthunt\.com\/products\//.test(r.url) && (n(String(r.url).split("/products/")[1]).includes(n(brand)) || n(String(r.title).split(/[:|-]/)[0]) === n(brand))).slice(0, 3);
  if (phHits.length || found.socials.producthunt)
    store.add({ source: "producthunt", kind: "observation", title: `Product Hunt presence: ${phHits.map(r => clip(r.title, 60)).join("; ") || found.socials.producthunt}`, url: phHits[0]?.url ?? `https://www.producthunt.com/products/${found.socials.producthunt}`, data: phHits.map(r => ({ title: r.title, url: r.url, snippet: clip(r.description, 200) })) });
}
