// Local user config (~/.config/reverse-engineer-marketing/config.json), written by the web UI.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = process.env.REM_CONFIG_DIR || join(homedir(), ".config", "reverse-engineer-marketing");
const FILE = join(DIR, "config.json");

export interface UserConfig {
  scrapecreatorsKey?: string;
}

export function readConfig(): UserConfig {
  try {
    return existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf8")) as UserConfig) : {};
  } catch {
    return {};
  }
}

export function writeConfig(patch: UserConfig): UserConfig {
  const next = { ...readConfig(), ...patch };
  for (const [k, v] of Object.entries(next)) if (v === "" || v == null) delete (next as any)[k];
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(next, null, 2), { mode: 0o600 });
  chmodSync(FILE, 0o600);
  applyConfig(next, true);
  return next;
}

/** Env vars win over the config file unless `override` (set from the UI just now). */
export function applyConfig(cfg = readConfig(), override = false): void {
  if (cfg.scrapecreatorsKey && (override || !process.env.SCRAPECREATORS_API_KEY)) process.env.SCRAPECREATORS_API_KEY = cfg.scrapecreatorsKey;
  if (override && !cfg.scrapecreatorsKey) delete process.env.SCRAPECREATORS_API_KEY;
}
