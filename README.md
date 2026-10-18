<div align="center">

# REM: Reverse Engineer Marketing

### Paste a link. Get the whole marketing machine behind it.

**Paid ads · organic social · SEO & AI search · founders · funnel · positioning history, with the evidence for every claim.**

<code>npx reverse-engineer-marketing notion.so</code>

[Quick start](#quick-start) · [Web app](#web-app-use-your-claude-code-or-codex-plan) · [What it finds](#what-it-finds) · [Use it from your agent (MCP)](#use-it-from-your-agent-mcp) · [Example report](examples/calai.app.md) · [How it works](#how-it-works)

</div>

---

Nobody shares their growth alpha anymore. But most of it is public if you know where to look: ad libraries show which ads have been running for months (the winners), pixels show which platforms they buy, sitemaps show programmatic SEO, Wayback shows every repositioning, and founders post their playbook in public.

REM collects all of it from one link and turns it into a report: what the company's growth engine is, how the channels connect, and a step-by-step playbook to copy it. Every fact cites the evidence it came from, and everything REM couldn't see is listed as unknown, with a link to check it yourself.

Inspired by [REA (Reverse Engineer Anything)](https://github.com/morluto/rea), but for marketing instead of binaries.

## Quick start

```bash
npx reverse-engineer-marketing linear.app
```

That works with **no API keys**: website, tracking pixels (including pixels hidden inside Google Tag Manager containers), SEO/sitemaps, AI-crawler stance, Wayback positioning history, App Store/Google Play and Hacker News.

Add keys to unlock the rest:

```bash
export SCRAPECREATORS_API_KEY=...   # ad libraries, social stats, founders, Reddit (~20–40 credits per run)
export ANTHROPIC_API_KEY=...        # the written strategy report (Claude)
npx reverse-engineer-marketing calai.app
```

Output goes to `./rem-reports/<domain>-<date>/`: `report.md` plus `evidence.json` (the raw evidence bundle).

It also accepts App Store and Google Play links: `rem https://apps.apple.com/us/app/…/id123`.

```
rem <url> [--no-ai] [--json] [--only paid,social,seo] [--handle tiktok=name] [--out dir]
rem web        # local web app (Claude Code / Codex subscription)
rem doctor     # which sources your keys unlock
rem setup      # commands to connect REM to Claude Code / Codex / Cursor
rem mcp        # run the MCP server
```

## Web app: use your Claude Code or Codex plan

```bash
npx reverse-engineer-marketing web
```

Opens a local web app at `http://localhost:4321`. Paste a link, pick who writes the report, and watch the evidence come in and the playbook stream out. Every `E12` citation opens the raw evidence behind it.

| Report writer | How it runs | Cost |
|---|---|---|
| **Claude Code** | your installed `claude` CLI, headless, no tools | your Claude subscription |
| **Codex** | your installed `codex exec`, read-only sandbox | your ChatGPT subscription |
| Anthropic API | `ANTHROPIC_API_KEY` | per token |
| Evidence only | no AI | free |

Subscription engines run the CLI you're already logged into. REM strips `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` from their environment so your plan is used, not an API key, and runs them in a scratch folder with your MCP servers and hooks disabled. The server listens on `127.0.0.1` only and rejects other hosts and origins. Add your Scrape Creators key from the top-right pill; it's saved to `~/.config/reverse-engineer-marketing/config.json` (mode 600). Past runs are listed on the home page.

## What it finds

| Area | What REM pulls | Needs a key? |
|---|---|---|
| **Paid: Meta** | Ads in library, active count, ads launched in the last 30 days, **longest-running active ads (the proven winners)** with hooks, formats, CTAs, landing pages, UTM campaign names, variant counts | Scrape Creators |
| **Paid: Google** | Ads pointing at the domain, formats, recency, and **other advertisers bidding on the brand** (affiliates/resellers) | Scrape Creators |
| **Paid: LinkedIn** | Ads by the company, ad types, headlines, CTAs | Scrape Creators |
| **Pixels & stack** | Meta/Google/TikTok/LinkedIn/Reddit/X/Pinterest/Snap pixels with IDs, **including inside GTM containers**; attribution SDKs (AppsFlyer, Adjust, Branch); affiliate tools; email/CRM; visitor-ID tools (RB2B, Warmly, Koala, Clearbit) that reveal an outbound motion; A/B testing | Free |
| **Organic social** | TikTok, Instagram, YouTube, X, LinkedIn: followers, posts/week, median reach, top posts and hooks, spark ads, days since last post. Finds TikTok even when the site doesn't link it | Scrape Creators |
| **SEO** | Sitemap size and folders, **programmatic page families** (`/integrations/{app}`, `/{a}-vs-{b}`, `/templates/…`), comparison/alternatives pages, content cadence, locales, top Google results | Free (+1 credit) |
| **AI search (GEO)** | llms.txt, which AI crawlers are blocked or allowed | Free |
| **Founders** | Founders/leaders, LinkedIn and X audience, whether they post, what they post about | Scrape Creators |
| **Community & launches** | Reddit threads and subreddits, Hacker News launches and points, Product Hunt | HN free; rest Scrape Creators |
| **Funnel & monetization** | Positioning, CTAs, pricing model, free plan/trial, per-seat/usage, sales-led signals, affiliate program and commission, social proof | Free |
| **Apps** | App Store ratings (download proxy), release age, update cadence, Play installs | Free |
| **Positioning history** | Homepage title/H1/CTAs over time from the Wayback Machine: pivots and repositioning | Free |

## Use it from your agent (MCP)

REM is an MCP server, so Claude Code, Codex, Cursor, or any MCP client can run it. With MCP you don't need an Anthropic key: your agent writes the report itself.

```bash
# Claude Code
claude mcp add reverse-engineer-marketing -e SCRAPECREATORS_API_KEY=... -- npx -y reverse-engineer-marketing mcp

# Codex
codex mcp add reverse-engineer-marketing --env SCRAPECREATORS_API_KEY=... -- npx -y reverse-engineer-marketing mcp
```

Any other client:

```json
{
  "mcpServers": {
    "reverse-engineer-marketing": {
      "command": "npx",
      "args": ["-y", "reverse-engineer-marketing", "mcp"],
      "env": { "SCRAPECREATORS_API_KEY": "..." }
    }
  }
}
```

Then ask:

> Reverse engineer the marketing of linear.app and give me a playbook I can copy.

| Tool | What it does |
|---|---|
| `reverse_engineer_marketing` | Collects everything for a URL. Returns a compact scorecard + evidence index + unknowns (token-cheap) and a `run_id` |
| `get_evidence` | Full data for specific evidence ids or a source (ad copy, top posts, sitemap families…) |
| `get_playbook` | The analysis method: role, evidence rules, report template, lessons, and per-channel playbooks |
| `validate_report` | Checks the agent's report: citations resolve, sections exist, playbook grounded, no invented spend |
| `write_report` | Optional server-side report (needs `ANTHROPIC_API_KEY` in the server env) |

Install the bundled skill to teach your agent the workflow: copy `skills/reverse-engineer-marketing/` into `~/.claude/skills/` (or your agent's skills folder).

## How it works

```
link ──► website scan ──► discovers socials, apps, people, brand
              │
              ├─► pixels + GTM containers      ├─► Meta / Google / LinkedIn ad libraries
              ├─► robots, sitemaps, llms.txt   ├─► TikTok / IG / YouTube / X / LinkedIn
              ├─► Wayback history              ├─► founders (LinkedIn + X)
              └─► App Store / Play / HN        └─► Reddit / Product Hunt
                                │
                    evidence bundle (E1…En) + unknowns
                                │
                  deterministic channel scorecard (no AI)
                                │
             Claude / your agent + the harness ──► report.md
                                │
                    validator (citations, grounding)
```

**Evidence contract.** Every item is an *observation* (seen at a URL or API) or a *derivation* (computed, e.g. posts/week). The report's interpretations must cite evidence ids and label inferences. Anything not checked is an *unknown*, never "they don't do it". A pixel means intent, not current spend, and dollar spend is never invented.

**The harness is a versioned file bundle** ([`harness/`](harness)): analyst role, guardrails, report template, a cue → lesson library, and one playbook per channel. Every report records the harness version and SHA. Change a playbook, run `npm run eval`, and compare scores. Recorded evidence bundles in `evals/fixtures/` let you iterate on the prompt without re-scraping.

**Cost per full run:** about 20–40 Scrape Creators credits plus one Claude call (default `claude-opus-5`, override with `REM_MODEL`). Scrape Creators responses are cached for 24h in `~/.cache/reverse-engineer-marketing` so agents can re-run without paying twice.

## Limits (honest)

- **TikTok and X ads** have no global public library; REM reports the pixel and gives you the manual library link. **Reddit's** ad library was shut down.
- Ad library counts come from samples (first pages); REM says "in the sample".
- Founder, TikTok-handle and Product Hunt matches come from search and can be wrong; weak matches are flagged.
- Server-side tracking and email tools are invisible from the browser, so they're reported as unknown.
- Respect each site's terms and your local laws. REM reads public pages and public ad transparency libraries only.

## Develop

```bash
git clone https://github.com/dansugc/reverse-engineer-marketing && cd reverse-engineer-marketing
npm install
npm run dev -- notion.so --no-ai   # run from source
npm test                           # unit tests (parsers, scorecard, validator)
npm run eval                       # validate example reports against recorded fixtures
npm run eval -- --live             # regenerate with Claude and score (costs tokens)
```

Adding a source: write a collector in `src/sources/` that adds evidence to the store (observations or derivations, never conclusions) and records unknowns with a manual-check link, then teach `src/analyze/scorecard.ts` what it means. See [AGENTS.md](AGENTS.md).

## License

MIT. Built by [DansUGC](https://dansugc.com).
