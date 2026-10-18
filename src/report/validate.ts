// Report validator: the eval gate for the harness. A report passes when every
// citation resolves, the required sections exist, and the playbook is grounded.
import type { EvidenceBundle } from "../index.js";

const REQUIRED = ["TL;DR", "Channel scorecard", "The engine", "Paid", "Organic social", "SEO", "Founders", "Funnel", "Steal this playbook", "Unknowns"];

export interface ValidationResult {
  ok: boolean;
  score: number;
  checks: { name: string; ok: boolean; detail: string }[];
}

export function validateReport(markdown: string, bundle: Pick<EvidenceBundle, "evidence" | "unknowns">): ValidationResult {
  const ids = new Set(bundle.evidence.map(e => e.id));
  const cited = [...markdown.matchAll(/\[(E\d+(?:\s*,\s*E\d+)*)\]/g)].flatMap(m => m[1]!.split(/\s*,\s*/));
  const dangling = [...new Set(cited.filter(c => !ids.has(c)))];
  const headings = [...markdown.matchAll(/^#{1,3}\s+(.+)$/gm)].map(m => m[1]!.toLowerCase());
  const missing = REQUIRED.filter(r => !headings.some(h => h.includes(r.toLowerCase())));

  const playbook = sectionBody(markdown, "steal this playbook");
  const steps = playbook.split("\n").filter(l => /^\s*\d+\./.test(l));
  const groundedSteps = steps.filter(l => /\[E\d+/.test(l));

  const tldr = sectionBody(markdown, "tl;dr").split("\n").filter(l => /^\s*[-*]/.test(l));
  const groundedTldr = tldr.filter(l => /\[E\d+/.test(l));

  const money = [...markdown.matchAll(/\$\s?\d[\d,.]*\s?(?:k|m)?\s*(?:\/\s?(?:mo|month|day))?\s*(?:in|of)?\s*(?:ad )?spend/gi)].map(m => m[0]);

  const checks = [
    { name: "citations resolve", ok: dangling.length === 0, detail: dangling.length ? `unknown ids: ${dangling.join(", ")}` : `${cited.length} citations` },
    { name: "required sections", ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : "all present" },
    { name: "playbook grounded", ok: steps.length >= 5 && groundedSteps.length >= Math.ceil(steps.length * 0.8), detail: `${groundedSteps.length}/${steps.length} steps cite evidence` },
    { name: "tl;dr grounded", ok: tldr.length >= 3 && groundedTldr.length === tldr.length, detail: `${groundedTldr.length}/${tldr.length} bullets cite evidence` },
    { name: "no invented spend", ok: money.length === 0, detail: money.length ? `spend figures: ${money.join("; ")}` : "none" },
    { name: "unknowns reported", ok: bundle.unknowns.length === 0 || /unknowns/i.test(headings.join(" ")), detail: `${bundle.unknowns.length} unknowns in bundle` },
  ];
  const passed = checks.filter(c => c.ok).length;
  return { ok: passed === checks.length, score: Math.round((passed / checks.length) * 100) / 100, checks };
}

function sectionBody(md: string, heading: string): string {
  const lines = md.split("\n");
  const start = lines.findIndex(l => /^#{1,3}\s/.test(l) && l.toLowerCase().includes(heading));
  if (start < 0) return "";
  const end = lines.findIndex((l, i) => i > start && /^#{1,2}\s/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}
