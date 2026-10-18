// `rem setup` — connect REM to your agents in one command (pattern from REA:
// show the plan, change nothing until approved, back up what you replace).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const NAME = "reverse-engineer-marketing";
const SERVER = ["npx", "-y", "reverse-engineer-marketing", "mcp"];

interface Step {
  client: string;
  description: string;
  run: () => void;
  skip?: string;
}

const has = (bin: string) => spawnSync(bin, ["--version"], { stdio: "ignore" }).status === 0;
const ok = (bin: string, args: string[]) => spawnSync(bin, args, { stdio: "ignore" }).status === 0;

function skillSource(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "skills", NAME);
}

export function plan(clients: string[]): Step[] {
  const steps: Step[] = [];
  const want = (c: string) => clients.includes("all") || clients.includes(c);
  if (want("claude_code")) {
    if (!has("claude")) steps.push({ client: "Claude Code", description: "not installed (npm i -g @anthropic-ai/claude-code)", run: () => {}, skip: "missing" });
    else {
      const registered = ok("claude", ["mcp", "get", NAME]);
      steps.push({
        client: "Claude Code",
        description: `claude mcp add --scope user ${NAME} -- ${SERVER.join(" ")}`,
        skip: registered ? "already registered" : undefined,
        run: () => {
          const r = spawnSync("claude", ["mcp", "add", "--scope", "user", NAME, "--", ...SERVER], { stdio: "inherit" });
          if (r.status !== 0) throw new Error("claude mcp add failed");
        },
      });
      const dest = join(homedir(), ".claude", "skills", NAME);
      steps.push({
        client: "Claude Code",
        description: `install skill → ${dest}${existsSync(dest) ? " (existing copy backed up)" : ""}`,
        run: () => {
          if (existsSync(dest)) renameSync(dest, `${dest}.bak-${Date.now()}`);
          cpSync(skillSource(), dest, { recursive: true });
        },
      });
    }
  }
  if (want("codex")) {
    if (!has("codex")) steps.push({ client: "Codex", description: "not installed (npm i -g @openai/codex)", run: () => {}, skip: "missing" });
    else {
      const registered = ok("codex", ["mcp", "get", NAME]);
      steps.push({
        client: "Codex",
        description: `codex mcp add ${NAME} -- ${SERVER.join(" ")}`,
        skip: registered ? "already registered" : undefined,
        run: () => {
          const r = spawnSync("codex", ["mcp", "add", NAME, "--", ...SERVER], { stdio: "inherit" });
          if (r.status !== 0) throw new Error("codex mcp add failed");
        },
      });
    }
  }
  return steps;
}

export async function setup(opts: { clients: string[]; yes: boolean; dryRun: boolean; json: boolean }): Promise<number> {
  const steps = plan(opts.clients.length ? opts.clients : ["all"]);
  const todo = steps.filter(s => !s.skip);
  if (opts.json) {
    console.log(JSON.stringify(steps.map(s => ({ client: s.client, action: s.description, skip: s.skip ?? null })), null, 2));
  } else {
    console.log("REM setup plan (nothing changes until you approve):\n");
    for (const s of steps) console.log(`  ${s.skip ? "·" : "→"} ${s.client.padEnd(12)} ${s.description}${s.skip ? `  [skip: ${s.skip}]` : ""}`);
    console.log("");
  }
  if (opts.dryRun || !todo.length) {
    if (!todo.length && !opts.json) console.log("Nothing to do.");
    return 0;
  }
  if (!opts.yes) {
    if (!process.stdin.isTTY) {
      console.log("Re-run with --yes to apply (non-interactive shell).");
      return 0;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question("Apply these changes? [y/N] ")).trim().toLowerCase();
    rl.close();
    if (answer !== "y" && answer !== "yes") {
      console.log("No changes made.");
      return 0;
    }
  }
  for (const s of todo) {
    s.run();
    console.log(`✓ ${s.client}: ${s.description}`);
  }
  console.log("\nRestart your agent, then ask: \"Reverse engineer the marketing of linear.app\".");
  return 0;
}
