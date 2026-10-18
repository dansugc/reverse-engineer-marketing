import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// src/web/page.ts and dist/web/page.js both sit two levels below the package root.
export const PAGE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "index.html"), "utf8");
