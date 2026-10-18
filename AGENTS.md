# Repository guidelines

REM (Reverse Engineer Marketing) collects public evidence of how a company acquires customers and turns it into an evidence-cited report. CLI and MCP share one pipeline (`src/index.ts`).

## Evidence contract

- Collectors (`src/sources/*`) add **observations** (seen at a URL/API) or **derivations** (computed from observations) to the `EvidenceStore`. They never write conclusions ("they scale with UGC"): that's the report's job.
- Anything not checked, blocked, or unavailable becomes an **Unknown** with a reason and, where possible, a `manualCheck` URL. Unknown is never "none".
- A negative needs a negative observation (e.g. ad library checked and empty).
- Keep evidence compact: clip long text (`clip()`), cap arrays, and keep the fields an analyst would quote (hooks, ad copy, dates, URLs).

## Layout

- `src/sources/` collectors (one area each). Pure parsing lives in `html.ts`, `seo.ts`, `tracking.ts` and is unit-tested.
- `src/analyze/scorecard.ts` deterministic channel scorecard (no LLM). Every row cites evidence ids.
- `src/analyze/synthesize.ts` Claude report from bundle + harness.
- `src/report/` deterministic Markdown + the validator (`validate.ts`) used by evals and the `validate_report` tool.
- `harness/` versioned analyst bundle (role, guardrails, template, lessons, playbooks). Listed in `manifest.json`; the loader fails if a file is missing and hashes the bundle into every report.
- `evals/` recorded evidence fixtures + `run.ts`.
- `src/engines.ts` report writers: Claude Code (`claude -p` stream-json), Codex (`codex exec --json`), Anthropic API. Subscription engines must never inherit API-key env vars.
- `src/web/server.ts` + `web/index.html` local web app (`rem web`): no framework, SSE job events, 127.0.0.1 + Host/Origin guard. `src/runs.ts` stores runs for web + MCP.

## Changing the harness

1. Edit a playbook / lesson / guardrail. Bump `harness/manifest.json` `version` for behavior changes.
2. `npm run eval -- --live` and compare `evals/results.jsonl` against the previous SHA.
3. Add a lesson (cue → lesson) when a review shows a recurring miss.

## Paid APIs

Scrape Creators calls go through `ScrapeCreators.get` (budgeted + 24h cache). Ask `sc.can(n)` before optional calls. Verify response shapes against a live call before relying on a field and read fields defensively.

## Checks

`npm run typecheck && npm test && npm run eval` before a PR. Don't commit `rem-reports/`, keys, or `dist/`.
