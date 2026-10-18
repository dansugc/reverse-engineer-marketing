# Contributing

PRs welcome, especially:

- **New sources** (e.g. TikTok Creative Center, Apple Search Ads, newsletter sponsorships, podcast ads, G2 reviews) following the evidence contract in [AGENTS.md](AGENTS.md).
- **New tracking signatures** in `src/sources/tracking.ts` (with a test).
- **Lessons and playbooks** in `harness/`, backed by an eval run.
- **Eval fixtures**: run `rem <url> --no-ai`, copy `evidence.json` to `evals/fixtures/<domain>.evidence.json`.

Run `npm run typecheck && npm test && npm run eval` before opening a PR.
