import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { synthesize } from "./analyze/synthesize.js";
import { loadHarness, playbook } from "./harness.js";
import { AREAS, reverseEngineer, VERSION, type EvidenceBundle } from "./index.js";
import { renderMarkdown, scorecardTable } from "./report/markdown.js";
import { validateReport } from "./report/validate.js";
import { loadRun as loadSavedRun, saveRun } from "./runs.js";

async function loadRun(id: string): Promise<EvidenceBundle> {
  try {
    return await loadSavedRun(id);
  } catch {
    throw new Error(`Unknown run_id "${id}". Call reverse_engineer_marketing first.`);
  }
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function createServer(): McpServer {
  const server = new McpServer({ name: "reverse-engineer-marketing", version: VERSION });

  server.registerTool(
    "reverse_engineer_marketing",
    {
      title: "Reverse engineer a company's marketing",
      description:
        "Collect public evidence of how a company acquires customers from one link (website, App Store or Google Play URL): ad libraries (Meta, Google, LinkedIn), ad/attribution pixels incl. inside GTM, organic TikTok/Instagram/YouTube/X/LinkedIn, SEO (sitemaps, programmatic pages, AI-crawler stance), founders, Reddit/HN/Product Hunt, pricing/funnel, App Store, and homepage positioning history. Returns a compact summary: deterministic channel scorecard, evidence index (ids + titles + URLs) and unknowns. Use get_evidence for details and get_playbook for the analysis method, then write the report citing [E#] ids.",
      inputSchema: {
        url: z.string().describe("Website domain/URL, App Store URL or Google Play URL"),
        only: z.array(z.enum(AREAS as [string, ...string[]])).optional().describe(`Limit to areas: ${AREAS.join(", ")}. Website always runs.`),
        handles: z.record(z.string(), z.string()).optional().describe('Override discovered handles, e.g. {"tiktok":"notionhq","x":"NotionHQ"}'),
        max_credits: z.number().int().min(0).max(500).optional().describe("Scrape Creators credit budget (default 50)"),
      },
    },
    async ({ url, only, handles, max_credits }) => {
      const bundle = await reverseEngineer(url, { only: only as any, handles: handles as any, maxCredits: max_credits });
      const { id, path } = await saveRun(bundle);
      return text(
        [
          `# ${bundle.brand} — evidence collected (run_id: ${id})`,
          `${bundle.evidence.length} evidence items · ${(bundle.content ?? []).length} posts/videos/ads (get_content) · ${bundle.unknowns.length} unknowns · ${bundle.credits.scrapecreators ?? 0} Scrape Creators credits · harness v${bundle.harness.version} (${bundle.harness.sha}) · full bundle: ${path}`,
          "",
          "## Channel scorecard (deterministic)",
          scorecardTable(bundle.scorecard),
          "",
          "## Evidence index",
          ...bundle.evidence.map(e => `- [${e.id}] (${e.source}) ${e.title}${e.url ? ` — ${e.url}` : ""}`),
          "",
          "## Unknowns",
          ...(bundle.unknowns.length ? bundle.unknowns.map(u => `- ${u.channel}: ${u.reason}${u.manualCheck ? ` → ${u.manualCheck}` : ""}`) : ["- none"]),
          "",
          "Next: call get_evidence (run_id, ids) for the items you need (ads copy, top posts, sitemap families, founders), get_playbook for the method and report format, write the report citing [E#], then validate_report.",
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "get_evidence",
    {
      title: "Get evidence details",
      description: "Full data for evidence items from a run: ad copy and longest-running ads, top posts and hooks, sitemap page families, founders, pricing signals, pixels. Filter by ids or source.",
      inputSchema: {
        run_id: z.string(),
        ids: z.array(z.string()).optional().describe('Evidence ids like ["E3","E7"]. Omit for all.'),
        source: z.string().optional().describe("Filter by source, e.g. meta_ads, tiktok, seo, founders"),
      },
    },
    async ({ run_id, ids, source }) => {
      const bundle = await loadRun(run_id);
      const items = bundle.evidence.filter(e => (!ids?.length || ids.includes(e.id)) && (!source || e.source === source));
      return text(JSON.stringify(items, null, 1));
    },
  );

  server.registerTool(
    "get_content",
    {
      title: "Get posts, videos and ads",
      description: "Concrete items to quote or show the user: Meta/Google/LinkedIn ads (with media URLs, running days, active/paused), TikTok and Instagram videos/posts, YouTube videos, X and LinkedIn posts (company + founders), Reddit threads and brand/founder replies. Each item links to the original.",
      inputSchema: {
        run_id: z.string(),
        platform: z.enum(["meta_ads", "google_ads", "linkedin_ads", "apple_ads", "tiktok", "instagram", "youtube", "x", "linkedin", "reddit"]).optional(),
        sort: z.enum(["top", "newest", "longest_running"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ run_id, platform, sort, limit }) => {
      const bundle = await loadRun(run_id);
      const score = (c: any) => c.metrics?.views ?? c.metrics?.likes ?? c.metrics?.score ?? c.metrics?.runningDays ?? 0;
      let items = (bundle.content ?? []).filter(c => !platform || c.platform === platform);
      if (sort === "newest") items = [...items].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
      else if (sort === "longest_running") items = [...items].sort((a, b) => (b.metrics?.runningDays ?? 0) - (a.metrics?.runningDays ?? 0));
      else if (sort === "top") items = [...items].sort((a, b) => score(b) - score(a));
      return text(JSON.stringify(items.slice(0, limit ?? 30), null, 1));
    },
  );

  server.registerTool(
    "get_playbook",
    {
      title: "Get the analysis playbook",
      description:
        "The REM harness: analyst role, evidence rules, report template and lesson library (default), or one channel playbook: paid-meta, paid-search, paid-b2b, organic-short-form, founder-led, seo-geo, community-launches, funnel-monetization, apps.",
      inputSchema: { name: z.string().optional() },
    },
    async ({ name }) => {
      const h = loadHarness();
      if (name) {
        const body = playbook(h, name);
        if (!body) throw new Error(`No playbook "${name}". Available: ${Object.keys(h.files).filter(f => f.startsWith("playbooks/")).map(f => f.slice(10, -3)).join(", ")}`);
        return text(body);
      }
      return text([h.files["system.md"], h.files["guardrails.md"], h.files["report-template.md"], h.files["lessons.md"]].join("\n\n---\n\n"));
    },
  );

  server.registerTool(
    "validate_report",
    {
      title: "Validate a report",
      description: "Check a written report against a run: citations resolve, required sections exist, TL;DR and playbook steps are grounded in evidence, no invented ad spend, unknowns reported.",
      inputSchema: { run_id: z.string(), markdown: z.string() },
    },
    async ({ run_id, markdown }) => text(JSON.stringify(validateReport(markdown, await loadRun(run_id)), null, 1)),
  );

  server.registerTool(
    "write_report",
    {
      title: "Write the report server-side",
      description: "Optional: have REM write the strategy report itself with Claude (needs ANTHROPIC_API_KEY in the MCP server env). Without a key, returns the deterministic evidence report.",
      inputSchema: { run_id: z.string(), model: z.string().optional() },
    },
    async ({ run_id, model }) => {
      const bundle = await loadRun(run_id);
      if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return text(renderMarkdown(bundle));
      const res = await synthesize(bundle, { model });
      return text(renderMarkdown(bundle, { narrative: res.markdown }));
    },
  );

  server.registerTool(
    "compare_runs",
    {
      title: "What changed since last time",
      description: "Diff two saved runs of the same company (competitive monitoring): ad counts, live ads, follower growth, sitemap size, channel status changes, homepage repositioning, and which ads/posts are new or no longer seen. Pass a domain to diff its two latest runs, or two run_ids.",
      inputSchema: { domain: z.string().optional(), run_a: z.string().optional(), run_b: z.string().optional() },
    },
    async ({ domain, run_a, run_b }) => {
      const { diffRuns, renderDiff } = await import("./report/diff.js");
      const { runsForDomain, resolveRun } = await import("./runs.js");
      let a: EvidenceBundle;
      let b: EvidenceBundle;
      if (run_a && run_b) [a, b] = [await resolveRun(run_a), await resolveRun(run_b)];
      else if (domain) {
        const runs = await runsForDomain(domain);
        if (runs.length < 2) throw new Error(`Need two saved runs of ${domain} (found ${runs.length}). Call reverse_engineer_marketing again later, then compare.`);
        [a, b] = [await resolveRun(runs[1]!.id), await resolveRun(runs[0]!.id)];
      } else throw new Error("Pass a domain, or run_a and run_b");
      return text(renderDiff(diffRuns(a, b)));
    },
  );

  // Guided workflows (REA-style named prompts): one click in clients that surface MCP prompts.
  const prompt = (name: string, title: string, description: string, args: Record<string, z.ZodString | z.ZodOptional<z.ZodString>>, body: (a: Record<string, string | undefined>) => string) =>
    server.registerPrompt(name, { title, description, argsSchema: args }, a => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: body(a as Record<string, string | undefined>) } }] }));

  prompt("investigate_company", "Investigate a company", "Full teardown: collect evidence, read the playbook, write an evidence-cited report, validate it.", { url: z.string() }, ({ url }) =>
    `Reverse engineer how ${url} gets customers. 1) Call reverse_engineer_marketing({url: "${url}"}). 2) Call get_playbook() and follow its report template and evidence rules. 3) Use get_evidence and get_content for the items you quote (longest-running ads, top posts, Apple Search Ads messages, Reddit threads, founders). 4) Write the report citing [E#] for every fact; label inferences "Likely". 5) Call validate_report and fix anything that fails before answering.`);

  prompt("compare_competitors", "Compare competitors", "Side-by-side teardown of 2–4 companies in the same market.", { urls: z.string().describe("comma-separated domains") }, ({ urls }) =>
    `Compare the marketing of: ${urls}. Run reverse_engineer_marketing on each. Then write one comparison: a channel-by-channel table (who wins each channel, with evidence ids per company), each company's engine in one line, the gaps none of them cover, and the single best play to copy from each. Cite evidence as company:E#.`);

  prompt("what_changed", "What changed since last time", "Monitor a competitor: re-run and diff against the previous run.", { url: z.string() }, ({ url }) =>
    `Run reverse_engineer_marketing({url: "${url}"}), then compare_runs({domain: "${url}"}). Explain what changed: new ad angles launched, ads killed, audience growth or decline, repositioning, new page families. Say what each change suggests about their strategy (label inferences), and what to watch next week.`);

  prompt("steal_the_playbook", "Steal the playbook (spec → build)", "Investigate → spec → build: turn a competitor teardown into your own 30-day plan with real assets.", { url: z.string(), my_product: z.string().optional() }, ({ url, my_product }) =>
    `Investigate → spec → build → verify, for marketing. 1) Investigate ${url} with reverse_engineer_marketing + get_playbook + get_content. 2) Spec: write the competitor's machine as a spec (channels, offer, funnel, cadence, creative angles) with [E#] citations. 3) Build for ${my_product ?? "my product"}: a 30-day plan — 10 ad hooks adapted (never copied) from their longest-running ads, 3 UGC video briefs (creator, hook, script beats, CTA), landing page outline, posting calendar per channel, SEO page template to start. Clean-room rule: copy the strategy and structure, never their exact copy, footage or brand. 4) Verify: list the metrics that prove it's working and when to re-run compare_runs.`);

  prompt("audit_unknowns", "Audit unknowns", "List what REM could not see for a run and exactly how to check each by hand.", { run_id: z.string() }, ({ run_id }) =>
    `For run ${run_id}: call get_evidence and read the unknowns. For each unknown channel, explain why it is unknown, how much it matters for this company, and the fastest manual check (use the manualCheck links). Then list which API keys or inputs (a handle, an app id) would close the most important gaps.`);

  return server;
}

export async function startMcp(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
