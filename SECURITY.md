# Security

REM runs on your machine and reads public data. Here is what it can and cannot touch.

## Your keys

- Keys are read from environment variables, a local `.env`, or `~/.config/reverse-engineer-marketing/config.json` (written by the web app with file mode `600`). They are never written to reports, evidence bundles, logs, the disk cache, or API responses. `/api/status` and `rem doctor` only say whether a key is set.
- The Scrape Creators key is sent only to `api.scrapecreators.com` (as a header). The Anthropic key is used only by the official Anthropic SDK.
- Subscription engines (Claude Code, Codex) run your installed CLI with `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `OPENAI_API_KEY` removed from their environment, so they use your logged-in plan and never see your API keys.
- The response cache (`~/.cache/reverse-engineer-marketing`) stores API responses keyed by a hash of the request URL. It contains scraped public data, never keys.

## Collected content is untrusted

- Page copy, ad text, posts and comments are written by third parties, and a hostile page can plant text aimed at the model that reads the evidence. In MCP mode that reader is your own agent, with its tools.
- Everything REM hands to a model (the report prompt and the `get_evidence`, `get_content`, `write_report` and `compare_runs` tool results) is wrapped in an `<untrusted-evidence>` fence with a random id, so text inside cannot close it early, plus a notice that the contents are data and not instructions. The harness guardrails and the skill carry the same rule.
- Collected text is scanned for common injection phrasing ("ignore previous instructions", fake system messages, requests to run commands or reveal keys). Matches are flagged to the model and listed in the report under "Suspected prompt injection".
- This lowers the risk. It does not remove it: the scan is a tripwire that misses clever attempts, and a fence is a strong hint to a model, not a sandbox. Keep the agent you connect REM to on a permission mode you are comfortable with.

## Local web app (`rem web`)

- Listens on `127.0.0.1` only. Requests with a `Host` other than `localhost:<port>` / `127.0.0.1:<port>` are rejected (DNS rebinding), and so are cross-origin writes (CSRF).
- Strict Content-Security-Policy: scripts only from the app and `cdn.jsdelivr.net` (marked, DOMPurify), no framing, API calls only to itself.
- Reports are written by a model over scraped content, so they are treated as untrusted: rendered through DOMPurify with images, media, forms, SVG and inline styles removed (no beacon/exfiltration via image URLs), and every link is restricted to `http(s)`.
- Report writers get no tools: Claude Code runs with `--tools ""`, no MCP servers and no user hooks, in an empty scratch folder. Codex runs `codex exec` with the read-only sandbox, ignoring your Codex config, in the same scratch folder; it is instructed not to run commands, but a read-only sandbox can still read files, so prefer Claude Code if that matters to you.
- The model name is validated before it becomes a CLI argument.

## Fetching

- Server-side fetches only go to public `http(s)` hosts. Loopback, private, link-local and `.local` addresses are blocked, and redirects are followed by hand so every hop is checked. (Hostnames that resolve to private IPs are not blocked; there is no DNS pinning.)
- Same-site key pages only; sitemaps are size-limited; requests time out.

## Reporting a vulnerability

Please open a private security advisory on GitHub (Security → Report a vulnerability) rather than a public issue.
