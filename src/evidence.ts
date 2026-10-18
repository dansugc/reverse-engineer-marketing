// Evidence contract (borrowed from REA): every fact REM reports is either an
// observation (seen directly at a URL / API) or a derivation (computed from
// observations). Interpretations ("they scale with UGC") belong to the report
// and must cite evidence ids. Anything we could not check is an Unknown, never
// silently treated as "not doing it".

export type SourceName =
  | "website"
  | "tracking"
  | "seo"
  | "wayback"
  | "appstore"
  | "meta_ads"
  | "google_ads"
  | "linkedin_ads"
  | "reddit_ads"
  | "tiktok"
  | "instagram"
  | "youtube"
  | "x"
  | "linkedin"
  | "threads"
  | "founders"
  | "reddit"
  | "hackernews"
  | "producthunt"
  | "wikidata";

export type Channel =
  | "paid_meta"
  | "paid_google"
  | "paid_linkedin"
  | "paid_reddit"
  | "paid_tiktok"
  | "organic_tiktok"
  | "organic_instagram"
  | "organic_youtube"
  | "organic_x"
  | "organic_linkedin"
  | "seo"
  | "geo"
  | "founder_led"
  | "reddit_marketing"
  | "community"
  | "launches"
  | "app_store"
  | "lifecycle"
  | "affiliate"
  | "sales_led";

export const CHANNELS: Channel[] = [
  "paid_meta",
  "paid_google",
  "paid_linkedin",
  "paid_reddit",
  "paid_tiktok",
  "organic_tiktok",
  "organic_instagram",
  "organic_youtube",
  "organic_x",
  "organic_linkedin",
  "seo",
  "geo",
  "founder_led",
  "reddit_marketing",
  "community",
  "launches",
  "app_store",
  "lifecycle",
  "affiliate",
  "sales_led",
];

export interface Evidence {
  id: string;
  source: SourceName;
  kind: "observation" | "derivation";
  /** One line a human can scan. */
  title: string;
  url?: string;
  observedAt: string;
  data: unknown;
}

export interface Unknown {
  channel: Channel | string;
  reason: string;
  /** A URL a human can open to check by hand. */
  manualCheck?: string;
}

export interface SourceRun {
  /** Collector label (an area can feed several evidence sources). */
  source: string;
  status: "ok" | "skipped" | "error";
  reason?: string;
  ms: number;
}

export class EvidenceStore {
  readonly items: Evidence[] = [];
  readonly unknowns: Unknown[] = [];
  readonly runs: SourceRun[] = [];
  private seq = 0;

  add(e: Omit<Evidence, "id" | "observedAt">): Evidence {
    const item: Evidence = { id: `E${++this.seq}`, observedAt: new Date().toISOString(), ...e };
    this.items.push(item);
    return item;
  }

  unknown(u: Unknown): void {
    if (!this.unknowns.some(x => x.channel === u.channel && x.reason === u.reason)) this.unknowns.push(u);
  }

  bySource(source: SourceName): Evidence[] {
    return this.items.filter(e => e.source === source);
  }

  find(source: SourceName, titlePrefix: string): Evidence | undefined {
    return this.items.find(e => e.source === source && e.title.startsWith(titlePrefix));
  }
}

/** A concrete post / video / ad / thread for humans to review (web Content tab, MCP get_content). Not sent to the LLM. */
export interface ContentItem {
  id: string;
  platform: "meta_ads" | "google_ads" | "linkedin_ads" | "tiktok" | "instagram" | "youtube" | "x" | "linkedin" | "reddit";
  kind: "ad" | "video" | "post" | "thread" | "comment";
  url: string;
  title?: string;
  text?: string;
  thumb?: string;
  video?: string;
  author?: string;
  date?: string;
  status?: "active" | "inactive";
  metrics?: { views?: number; likes?: number; comments?: number; shares?: number; score?: number; runningDays?: number; variants?: number };
  tags?: string[];
  evidence?: string;
}
