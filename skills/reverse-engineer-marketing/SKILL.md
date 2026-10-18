---
name: reverse-engineer-marketing
description: Reverse engineer how any company gets customers from one link (website, App Store or Google Play URL) — paid ads (Meta, Google, LinkedIn ad libraries, pixels incl. inside GTM), organic TikTok/Instagram/YouTube/X/LinkedIn, SEO and AI search, founders, Reddit/HN/Product Hunt, pricing and funnel, positioning history — and turn it into an evidence-cited playbook to copy. Use for competitor research, "how does X grow/market/acquire users", "reverse engineer X's marketing", "what ads is X running", or "steal X's growth playbook".
metadata:
  version: "1"
---

# Reverse Engineer Marketing (REM)

Use REM when someone wants to know how a company acquires customers, or wants a growth playbook copied from a competitor. REM collects public evidence; you interpret it and write the report.

## Connect

If the `reverse_engineer_marketing` tool is available, use it. If not:

- Add the MCP server: `claude mcp add reverse-engineer-marketing -e SCRAPECREATORS_API_KEY=… -- npx -y reverse-engineer-marketing mcp` (then restart the agent), or
- Use the CLI directly: `npx -y reverse-engineer-marketing <url> --json` returns the same evidence bundle.

`npx -y reverse-engineer-marketing doctor` shows which sources are unlocked. Without `SCRAPECREATORS_API_KEY`, ad libraries, social stats and founders come back as unknowns with manual-check links; website, pixels, SEO, Wayback, App Store and Hacker News still work.

## Workflow

1. `reverse_engineer_marketing({ url })`. One call collects everything (~20–40s, ~25–50 Scrape Creators credits). If you already know a handle the site doesn't link, pass `handles: { tiktok: "…" }`.
2. Read the returned scorecard and evidence index. The scorecard is deterministic: don't contradict it, explain it.
3. `get_playbook()` once for the analyst role, evidence rules, report template and lesson library. Pull a channel playbook (`paid-meta`, `seo-geo`, `organic-short-form`, `founder-led`, …) when that channel matters.
4. `get_evidence({ run_id, ids })` for the items you'll quote: Meta longest-running ads, top TikTok/IG/X posts, sitemap families, founders, pricing.
5. Write the report in the template's sections. Every fact cites `[E#]`. Label inferences "Likely…". Put unknowns in their own section with the manual-check links.
6. `validate_report({ run_id, markdown })` and fix anything that fails before answering.

## Rules that matter most

- Unknown ≠ not doing it. Only a checked-and-empty source is a negative.
- A pixel means intent or past use. Only the ad library confirms current ads.
- No dollar spend figures unless a source states them; use spend proxies (active ads, ad longevity, launch rate).
- Ads running 60+ days are the proven winners. Lead with them and quote their hooks exactly.
- Founders carry a confidence (high = Wikidata/JSON-LD or two sources). Never state a low-confidence name as fact. Search-based matches (TikTok handle, Product Hunt) can be wrong too.
- Reddit affiliation ("brand/founder posts") is inferred from usernames and "I'm the founder"-style phrases; say "likely".
- Finish with "Steal this playbook": 5–10 concrete steps with numbers, each tied to evidence.
