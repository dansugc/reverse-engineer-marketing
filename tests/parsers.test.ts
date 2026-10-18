import { describe, expect, it } from "vitest";
import { scorecard } from "../src/analyze/scorecard.js";
import { EvidenceStore } from "../src/evidence.js";
import { collapseRepeats, extractAppIds, extractPeople, extractSocials, extractUtms, pageFacts, pickKeyPages, pricingSignals } from "../src/sources/html.js";
import { analyzeSitemap, parseRobots, parseSitemap } from "../src/sources/seo.js";
import { detectTags, mergeTags } from "../src/sources/tracking.js";
import { brandFromDomain, parseTarget, sameSite } from "../src/target.js";
import { validateReport } from "../src/report/validate.js";

describe("target", () => {
  it("parses domains, URLs and store links", () => {
    expect(parseTarget("notion.so")).toMatchObject({ kind: "website", domain: "notion.so", url: "https://notion.so", brand: "Notion" });
    expect(parseTarget("https://www.linear.app/pricing")).toMatchObject({ domain: "linear.app", url: "https://www.linear.app" });
    expect(parseTarget("https://apps.apple.com/us/app/cal-ai/id6480417616")).toMatchObject({ kind: "app_store", appleId: "6480417616" });
    expect(parseTarget("https://play.google.com/store/apps/details?id=com.foo.bar")).toMatchObject({ kind: "play_store", playId: "com.foo.bar" });
    expect(() => parseTarget("not a url")).toThrow();
  });
  it("derives a brand from the registrable label", () => {
    expect(brandFromDomain("app.notion.so")).toBe("Notion");
    expect(brandFromDomain("getcal.com")).toBe("Cal");
    expect(brandFromDomain("shop.example.co.uk")).toBe("Example");
  });
  it("compares sites ignoring www and subdomains", () => {
    expect(sameSite("https://www.notion.so/x", "notion.so")).toBe(true);
    expect(sameSite("help.notion.so", "notion.so")).toBe(true);
    expect(sameSite("notion.com", "notion.so")).toBe(false);
  });
});

describe("tracking", () => {
  const html = `
    <script>fbq('init', '123456789012345');</script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ"></script>
    <script>gtag('config','AW-1234567890');</script>
    <script>ttq.load('C9ABCDEF1234567890');</script>
    <script src="https://r.wdfl.co/rw.js"></script>
    <script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABCD12"></script>`;
  it("finds pixels with ids", () => {
    const tags = detectTags(html);
    const by = Object.fromEntries(tags.map(t => [t.id, t]));
    expect(by.meta_pixel?.ids).toEqual(["123456789012345"]);
    expect(by.google_ads?.ids).toEqual(["AW-1234567890"]);
    expect(by.tiktok_pixel?.ids).toEqual(["C9ABCDEF1234567890"]);
    expect(by.ga4?.ids).toEqual(["G-ABC123XYZ"]);
    expect(by.gtm?.ids).toEqual(["GTM-ABCD12"]);
    expect(by.rewardful?.implies).toBe("affiliate");
  });
  it("merges page and GTM findings", () => {
    const merged = mergeTags(detectTags(html), detectTags("snap.licdn.com/li.lms-analytics/insight.min.js _linkedin_partner_id = '998877';", "GTM-ABCD12"));
    const li = merged.find(t => t.id === "linkedin_insight");
    expect(li?.foundIn).toEqual(["GTM-ABCD12"]);
    expect(li?.ids).toEqual(["998877"]);
  });
});

describe("html", () => {
  const links = [
    "https://www.tiktok.com/@acmehq?lang=en",
    "https://instagram.com/acme/",
    "https://www.instagram.com/p/XYZ/",
    "https://twitter.com/intent/tweet?url=x",
    "https://x.com/AcmeHQ",
    "https://www.linkedin.com/company/acme-inc/",
    "https://www.linkedin.com/in/jane-founder/",
    "https://www.youtube.com/@acme",
    "https://apps.apple.com/us/app/acme/id123456789",
    "https://play.google.com/store/apps/details?id=com.acme.app",
    "https://partner.com/?utm_source=acme&utm_medium=referral&utm_campaign=launch",
  ];
  it("extracts socials, people, apps, utms", () => {
    expect(extractSocials(links)).toMatchObject({ tiktok: "acmehq", instagram: "acme", x: "AcmeHQ", linkedin: "acme-inc", youtube: "@acme" });
    expect(extractPeople(links)).toEqual(["https://www.linkedin.com/in/jane-founder"]);
    expect(extractAppIds(links)).toEqual({ apple: ["123456789"], play: ["com.acme.app"] });
    expect(extractUtms(links)[0]).toMatchObject({ source: "acme", medium: "referral", campaign: "launch" });
  });
  it("picks key pages on the same site", () => {
    const pages = pickKeyPages("https://acme.com", ["/pricing", "/about-us", "https://acme.com/affiliates", "https://other.com/pricing", "/blog/post-1", "/vs/rival"]);
    expect(pages).toMatchObject({ pricing: "https://acme.com/pricing", about: "https://acme.com/about-us", affiliate: "https://acme.com/affiliates", blog: "https://acme.com/blog/post-1", compare: "https://acme.com/vs/rival" });
  });
  it("reads page facts and JSON-LD", () => {
    const f = pageFacts(
      `<html lang="en"><head><title>Acme | Do X</title><meta name="description" content="desc"><meta property="og:site_name" content="Acme">
       <script type="application/ld+json">{"@type":"SoftwareApplication","aggregateRating":{"ratingValue":"4.8","ratingCount":"1200"},"sameAs":["https://x.com/acme"]}</script></head>
       <body><h1>Ship faster</h1><a class="btn" href="/signup">Start free trial</a><button>Book a demo</button></body></html>`,
      "https://acme.com",
    );
    expect(f).toMatchObject({ title: "Acme | Do X", siteName: "Acme", h1: ["Ship faster"], lang: "en", rating: { value: 4.8, count: 1200 } });
    expect(f.ctas).toEqual(expect.arrayContaining(["Start free trial", "Book a demo"]));
    expect(f.sameAs).toContain("https://x.com/acme");
  });
  it("collapses animated repeated headlines", () => {
    expect(collapseRepeats("Ship fasterShip fasterShip faster")).toBe("Ship faster");
    expect(collapseRepeats("Go go")).toBe("Go go");
  });
  it("reads pricing signals", () => {
    const p = pricingSignals("Free plan forever. Pro $12/user per month billed annually, save 20%. 14-day free trial. Enterprise: contact sales.");
    expect(p).toMatchObject({ freePlan: true, freeTrial: true, trialDays: 14, perSeat: true, annualDiscount: true, contactSales: true });
    expect(p.prices[0]).toContain("$12");
  });
});

describe("seo", () => {
  it("parses robots AI stance", () => {
    const r = parseRobots("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\nSitemap: https://a.com/sitemap.xml");
    expect(r.aiBots.GPTBot).toBe("blocked");
    expect(r.aiBots.ClaudeBot).toBe("unspecified");
    expect(r.sitemaps).toEqual(["https://a.com/sitemap.xml"]);
  });
  it("parses sitemap indexes and url sets", () => {
    expect(parseSitemap("<sitemapindex><sitemap><loc>https://a.com/s1.xml</loc></sitemap></sitemapindex>").children).toEqual(["https://a.com/s1.xml"]);
    expect(parseSitemap("<urlset><url><loc>https://a.com/a</loc><lastmod>2026-10-01</lastmod></url></urlset>").urls).toEqual([{ loc: "https://a.com/a", lastmod: "2026-10-01" }]);
  });
  it("spots programmatic families and comparison pages", () => {
    const now = Date.parse("2026-10-18");
    const urls = [
      ...Array.from({ length: 120 }, (_, i) => ({ loc: `https://a.com/integrations/app-${i}` })),
      ...Array.from({ length: 30 }, (_, i) => ({ loc: `https://a.com/compare/a-vs-tool${i}` })),
      ...Array.from({ length: 10 }, (_, i) => ({ loc: `https://a.com/blog/post-${i}`, lastmod: "2026-10-10" })),
      { loc: "https://a.com/de/pricing/x" },
    ];
    const a = analyzeSitemap(urls, now);
    expect(a.sections.find(s => s.path === "/integrations")?.programmatic).toBe(true);
    expect(a.patterns.comparison).toBe(30);
    expect(a.blogPostsLast30d).toBe(10);
    expect(a.locales).toEqual(["de"]);
  });
});

describe("scorecard + validator", () => {
  it("never treats a missing source as 'none'", () => {
    const store = new EvidenceStore();
    store.add({ source: "tracking", kind: "observation", title: "Ad/attribution pixels: Meta Pixel", data: { pixels: [{ id: "meta_pixel", name: "Meta Pixel" }] } });
    store.unknown({ channel: "paid_google", reason: "SCRAPECREATORS_API_KEY not set" });
    const card = Object.fromEntries(scorecard(store).map(c => [c.channel, c]));
    expect(card.paid_meta).toMatchObject({ status: "likely", strength: 1 });
    expect(card.paid_google).toMatchObject({ status: "unknown" });
  });
  it("flags dangling citations and invented spend", () => {
    const bundle = { evidence: [{ id: "E1" }, { id: "E2" }] as any, unknowns: [] };
    const md = "# How X\n## TL;DR\n- a [E1]\n- b [E9]\n- c [E2]\n## Paid\nThey spend $50k/month in ad spend [E1]";
    const v = validateReport(md, bundle);
    expect(v.ok).toBe(false);
    expect(v.checks.find(c => c.name === "citations resolve")?.detail).toContain("E9");
    expect(v.checks.find(c => c.name === "no invented spend")?.ok).toBe(false);
  });
});

describe("identity", () => {
  it("extracts founder names from prose and rejects non-names", async () => {
    const { extractFounderNames, looksLikeName } = await import("../src/sources/html.js");
    expect(extractFounderNames("Cal AI was founded by Zach Yadegari, Henry Langmack and Blake Anderson in 2024.", "Cal AI").map(f => f.name)).toEqual(["Zach Yadegari", "Henry Langmack", "Blake Anderson"]);
    expect(extractFounderNames("Ivan Zhao, Co-founder & CEO. Read More", "Notion")).toEqual([{ name: "Ivan Zhao", role: "Co-founder & CEO" }]);
    expect(looksLikeName("Our Team")).toBe(false);
    expect(looksLikeName("Cal AI", "Cal AI")).toBe(false);
  });
  it("reads logos and JSON-LD founders", () => {
    const f = pageFacts(
      `<head><link rel="apple-touch-icon" sizes="180x180" href="/apple.png"><link rel="icon" href="/favicon.ico"><meta property="og:image" content="https://a.com/og.png">
       <script type="application/ld+json">{"@type":"Organization","logo":"https://a.com/logo.png","founder":[{"@type":"Person","name":"Jane Doe"}]}</script></head><body></body>`,
      "https://a.com",
    );
    expect(f.logos.map(l => l.source)).toEqual(expect.arrayContaining(["apple-touch-icon", "icon", "og-image", "jsonld"]));
    expect(f.jsonLdFounders).toEqual([{ name: "Jane Doe", role: "Founder", url: undefined }]);
  });
  it("ranks square marks above banners and merges founder sources", async () => {
    const { rankLogos } = await import("../src/sources/identity.js");
    const { mergeFounders } = await import("../src/sources/people.js");
    const ranked = rankLogos([{ url: "og", source: "og-image" }, { url: "touch", source: "apple-touch-icon", size: 180 }, { url: "li", source: "linkedin" }], "a.com");
    expect(ranked.map(l => l.source)).toEqual(["apple-touch-icon", "linkedin", "og-image", "favicon"]);
    const merged = mergeFounders([
      { name: "Zach Yadegari", source: "google_snippet", role: "Founder" },
      { name: "Zach Yadegari", source: "linkedin_search", role: "Co-Founder & CEO", linkedin: "https://linkedin.com/in/z" },
      { name: "Some Person", source: "website_text" },
    ]);
    expect(merged[0]).toMatchObject({ name: "Zach Yadegari", role: "Co-Founder & CEO", confidence: "high", linkedin: "https://linkedin.com/in/z" });
    expect(merged[1]?.confidence).toBe("low");
  });
});

describe("reddit", () => {
  it("matches the brand on word boundaries and flags affiliated posts", async () => {
    const { mentions, classifyPost } = await import("../src/sources/reddit.js");
    expect(mentions("I tried Cal AI for a month", "Cal AI")).toBe(true);
    expect(mentions("local airport delays", "Cal AI")).toBe(false);
    expect(mentions("check calai.app", "Cal AI", "calai.app")).toBe(true);
    const p = classifyPost({ id: "1", subreddit: "SideProject", title: "I built Cal AI, an app that counts calories from a photo", selftext: "", author: "zach", score: 40, num_comments: 12, url: "https://reddit.com/r/x/1" }, "Cal AI");
    expect(p).toMatchObject({ selfPromo: true, affiliated: true });
    expect(classifyPost({ id: "2", subreddit: "x", title: "MyFitnessPal vs Cal AI?", selftext: "", author: "u", url: "u" }, "Cal AI")).toMatchObject({ comparison: true, affiliated: false });
    expect(classifyPost({ id: "3", subreddit: "x", title: "unrelated", selftext: "", author: "u", url: "u" }, "Cal AI")).toBeNull();
  });
});

describe("security", () => {
  it("blocks private, loopback and non-http targets", async () => {
    const { assertPublicUrl } = await import("../src/http.js");
    for (const bad of ["http://localhost:4321/api/status", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://172.20.0.1/", "file:///etc/passwd", "http://router.local/", "http://intranet/"])
      expect(() => assertPublicUrl(bad), bad).toThrow();
    expect(assertPublicUrl("https://notion.so/").hostname).toBe("notion.so");
    expect(() => parseTarget("localhost:4321")).toThrow();
  });
  it("rejects model names that look like CLI flags", async () => {
    const { writeReport } = await import("../src/engines.js");
    await expect(writeReport("claude-code", {} as any, { model: "--dangerously-skip-permissions" })).rejects.toThrow("Invalid model name");
  });
});
