// Pure HTML helpers (unit-tested in tests/html.test.ts).
import { parse, type HTMLElement } from "node-html-parser";
import type { Discovered } from "../context.js";

export interface PageFacts {
  title: string;
  description: string;
  siteName?: string;
  h1: string[];
  h2: string[];
  ctas: string[];
  links: string[];
  scripts: string[];
  jsonLdTypes: string[];
  sameAs: string[];
  rating?: { value: number; count: number };
  lang?: string;
  wordCount: number;
}

export function pageFacts(html: string, baseUrl: string): PageFacts {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: false, noscript: false } });
  const meta = (sel: string) => root.querySelector(sel)?.getAttribute("content")?.trim() ?? "";
  const text = (el: HTMLElement) => collapseRepeats(el.text.replace(/\s+/g, " ").trim());

  const links: string[] = [];
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    try {
      links.push(new URL(href, baseUrl).toString());
    } catch {
      // ignore malformed
    }
  }

  const ctas = new Set<string>();
  for (const el of root.querySelectorAll("a, button")) {
    const t = text(el);
    if (t.length < 3 || t.length > 40) continue;
    const cls = `${el.getAttribute("class") ?? ""} ${el.getAttribute("role") ?? ""}`;
    if (CTA_TEXT.test(t) || /\b(btn|button|cta)\b/i.test(cls)) ctas.add(t);
    if (ctas.size >= 15) break;
  }

  const jsonLdTypes = new Set<string>();
  const sameAs = new Set<string>();
  let rating: PageFacts["rating"];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walkJsonLd(JSON.parse(s.rawText), node => {
        const t = node["@type"];
        for (const x of Array.isArray(t) ? t : [t]) if (typeof x === "string") jsonLdTypes.add(x);
        const sa = node.sameAs;
        for (const x of Array.isArray(sa) ? sa : [sa]) if (typeof x === "string") sameAs.add(x);
        const ar = node.aggregateRating;
        if (ar && !rating) {
          const value = Number(ar.ratingValue);
          const count = Number(ar.ratingCount ?? ar.reviewCount);
          if (Number.isFinite(value) && Number.isFinite(count)) rating = { value, count };
        }
      });
    } catch {
      // invalid JSON-LD is common
    }
  }

  const scripts = root
    .querySelectorAll("script[src]")
    .map(s => s.getAttribute("src") ?? "")
    .filter(Boolean);

  const bodyText = root.querySelector("body")?.text ?? "";
  return {
    title: text(root.querySelector("title") ?? parse("<i></i>")),
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    siteName: meta('meta[property="og:site_name"]') || undefined,
    h1: root.querySelectorAll("h1").map(text).filter(Boolean).slice(0, 3),
    h2: root.querySelectorAll("h2").map(text).filter(Boolean).slice(0, 10),
    ctas: [...ctas],
    links: [...new Set(links)],
    scripts,
    jsonLdTypes: [...jsonLdTypes],
    sameAs: [...sameAs],
    rating,
    lang: root.querySelector("html")?.getAttribute("lang") ?? undefined,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
  };
}

/** Animated headlines often render the same phrase 2–4 times in the DOM. */
export function collapseRepeats(t: string): string {
  for (let k = 4; k >= 2; k--) {
    if (t.length % k) continue;
    const p = t.slice(0, t.length / k);
    if (p.length >= 8 && p.repeat(k) === t) return p;
  }
  return t;
}

const CTA_TEXT =
  /^(get started|start|try|sign up|signup|join|book|request|schedule|talk to|contact sales|download|get the app|get .{0,20}free|start .{0,20}free|try .{0,20}free|claim|buy|subscribe|install|add to|create .{0,15}account|see (a )?demo|watch (the )?demo|apply)/i;

function walkJsonLd(node: any, visit: (n: any) => void, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 6) return;
  if (Array.isArray(node)) {
    for (const x of node) walkJsonLd(x, visit, depth + 1);
    return;
  }
  visit(node);
  for (const v of Object.values(node)) if (v && typeof v === "object") walkJsonLd(v, visit, depth + 1);
}

const SOCIAL_RULES: [keyof Discovered["socials"], RegExp][] = [
  ["tiktok", /tiktok\.com\/@([A-Za-z0-9._]{2,30})/i],
  ["instagram", /instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/)([A-Za-z0-9._]{2,30})/i],
  ["youtube", /youtube\.com\/(@[A-Za-z0-9._-]{2,40}|channel\/[A-Za-z0-9_-]{10,}|c\/[A-Za-z0-9._-]{2,40}|user\/[A-Za-z0-9._-]{2,40})/i],
  ["x", /(?:twitter|x)\.com\/(?!intent\/|share|home|search|i\/)([A-Za-z0-9_]{2,15})(?:[/?#]|$)/i],
  ["linkedin", /linkedin\.com\/company\/([A-Za-z0-9._%-]{2,80})/i],
  ["facebook", /facebook\.com\/(?!sharer|share|dialog|plugins|tr\b)([A-Za-z0-9.]{2,60})/i],
  ["threads", /threads\.(?:net|com)\/@([A-Za-z0-9._]{2,30})/i],
  ["reddit", /reddit\.com\/r\/([A-Za-z0-9_]{2,30})/i],
  ["discord", /(discord\.gg\/[A-Za-z0-9]+|discord\.com\/invite\/[A-Za-z0-9]+)/i],
  ["github", /github\.com\/([A-Za-z0-9-]{2,40})(?:[/?#]|$)/i],
  ["producthunt", /producthunt\.com\/(?:products|posts)\/([A-Za-z0-9-]{2,80})/i],
];

/** First matching handle per platform; site footer links usually win over share buttons. */
export function extractSocials(links: string[]): Discovered["socials"] {
  const out: Discovered["socials"] = {};
  for (const link of links) {
    for (const [platform, re] of SOCIAL_RULES) {
      if (out[platform]) continue;
      const m = link.match(re);
      if (m?.[1]) out[platform] = decodeURIComponent(m[1]).replace(/\/$/, "");
    }
  }
  return out;
}

export function extractPeople(links: string[]): string[] {
  const out = new Set<string>();
  for (const l of links) {
    const m = l.match(/linkedin\.com\/in\/([A-Za-z0-9_%-]{2,100})/i);
    if (m?.[1]) out.add(`https://www.linkedin.com/in/${m[1].replace(/\/$/, "")}`);
  }
  return [...out].slice(0, 10);
}

export function extractAppIds(links: string[]): { apple: string[]; play: string[] } {
  const apple = new Set<string>();
  const play = new Set<string>();
  for (const l of links) {
    const a = l.match(/apps\.apple\.com\/.*\/id(\d{6,})/i);
    if (a?.[1]) apple.add(a[1]);
    const p = l.match(/play\.google\.com\/store\/apps\/details\?id=([A-Za-z0-9._]+)/i);
    if (p?.[1]) play.add(p[1]);
  }
  return { apple: [...apple], play: [...play] };
}

/** utm_* tags on outbound and internal links reveal campaign naming and partner deals. */
export function extractUtms(links: string[]): { url: string; source?: string; medium?: string; campaign?: string }[] {
  const out: { url: string; source?: string; medium?: string; campaign?: string }[] = [];
  for (const l of links) {
    try {
      const u = new URL(l);
      if (![...u.searchParams.keys()].some(k => k.startsWith("utm_") || k === "ref" || k === "via")) continue;
      out.push({
        url: `${u.origin}${u.pathname}`,
        source: u.searchParams.get("utm_source") ?? u.searchParams.get("ref") ?? u.searchParams.get("via") ?? undefined,
        medium: u.searchParams.get("utm_medium") ?? undefined,
        campaign: u.searchParams.get("utm_campaign") ?? undefined,
      });
    } catch {
      // ignore
    }
  }
  return out.slice(0, 20);
}

const KEY_PAGES: [string, RegExp][] = [
  ["pricing", /\/(pricing|plans|price|upgrade)(\/|$)/i],
  ["about", /\/(about|about-us|company|team|our-story|founders?)(\/|$)/i],
  ["affiliate", /\/(affiliates?|partners?|referral|refer|ambassadors?|creators?-program|partner-program)(\/|$)/i],
  ["customers", /\/(customers|case-studies|stories|testimonials|wall-of-love|love)(\/|$)/i],
  ["blog", /\/(blog|articles|resources|insights|news)(\/|$)/i],
  ["careers", /\/(careers|jobs|hiring)(\/|$)/i],
  ["changelog", /\/(changelog|releases|whats-new|updates)(\/|$)/i],
  ["compare", /\/(vs|compare|alternatives?|comparison)(\/|-|$)/i],
  ["integrations", /\/(integrations|apps|marketplace)(\/|$)/i],
  ["templates", /\/(templates|gallery|examples|showcase)(\/|$)/i],
  ["demo", /\/(demo|book-a-demo|contact-sales|talk-to-sales|get-a-demo)(\/|$)/i],
];

/** Same-site key pages, one per kind. */
export function pickKeyPages(home: string, links: string[]): Record<string, string> {
  const base = new URL(home);
  const host = base.hostname.replace(/^www\./, "");
  const out: Record<string, string> = {};
  for (const raw of links) {
    let u: URL;
    try {
      u = new URL(raw, base);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, "") !== host && !u.hostname.endsWith(`.${host}`)) continue;
    for (const [kind, re] of KEY_PAGES) {
      if (out[kind] || !re.test(`${u.pathname}/`)) continue;
      out[kind] = `${u.origin}${u.pathname}`;
    }
  }
  return out;
}

export interface PricingSignals {
  prices: string[];
  freePlan: boolean;
  freeTrial: boolean;
  trialDays?: number;
  moneyBack: boolean;
  contactSales: boolean;
  perSeat: boolean;
  annualDiscount: boolean;
  lifetimeDeal: boolean;
  usageBased: boolean;
}

export function pricingSignals(text: string): PricingSignals {
  const t = text.replace(/\s+/g, " ");
  const prices = [...new Set([...t.matchAll(/(?:[$€£]\s?\d{1,4}(?:[.,]\d{2})?)(?:\s?\/\s?(?:mo|month|yr|year|user|seat|week))?/gi)].map(m => m[0].trim()))].slice(0, 12);
  const trial = t.match(/(\d{1,2})[- ]day (?:free )?trial/i);
  return {
    prices,
    freePlan: /\bfree (?:plan|forever|tier)\b|\$0\b/i.test(t),
    freeTrial: /free trial|try (?:it )?free|start free/i.test(t),
    trialDays: trial?.[1] ? Number(trial[1]) : undefined,
    moneyBack: /money[- ]back|refund guarantee/i.test(t),
    contactSales: /contact sales|talk to sales|book a demo|get a demo|request a demo|enterprise/i.test(t),
    perSeat: /per (?:user|seat|member)|\/\s?(?:user|seat)/i.test(t),
    annualDiscount: /billed annually|save \d{1,2}%|annual(?:ly)? .{0,20}(?:save|off|discount)/i.test(t),
    lifetimeDeal: /lifetime (?:deal|access|plan)|one[- ]time payment|pay once/i.test(t),
    usageBased: /pay as you go|usage[- ]based|per (?:credit|request|minute|token|call)|credits/i.test(t),
  };
}

export function visibleText(html: string): string {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false } });
  return (root.querySelector("body") ?? root).text.replace(/\s+/g, " ").trim();
}
