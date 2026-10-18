export interface Target {
  input: string;
  kind: "website" | "app_store" | "play_store";
  /** Homepage URL (may be filled in later for app-store inputs). */
  url?: string;
  domain?: string;
  /** Other domains that redirect here (e.g. notion.so → notion.com). */
  aliases?: string[];
  brand?: string;
  appleId?: string;
  playId?: string;
}

/** Accepts "notion.so", "https://www.notion.so/pricing", App Store or Google Play links. */
export function parseTarget(input: string): Target {
  const raw = input.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new Error(`Not a URL or domain: ${input}`);
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "apps.apple.com" || host === "itunes.apple.com") {
    const id = u.pathname.match(/id(\d{6,})/)?.[1];
    if (!id) throw new Error(`Could not find an App Store id in ${input}`);
    return { input: raw, kind: "app_store", appleId: id };
  }
  if (host === "play.google.com") {
    const id = u.searchParams.get("id");
    if (!id) throw new Error(`Could not find a Play Store package id in ${input}`);
    return { input: raw, kind: "play_store", playId: id };
  }
  if (!host.includes(".")) throw new Error(`Not a URL or domain: ${input}`);
  return { input: raw, kind: "website", url: `https://${u.hostname}`, domain: host, brand: brandFromDomain(host) };
}

export function brandFromDomain(domain: string): string {
  const parts = domain.replace(/^www\./, "").split(".");
  // Registrable label: "app.notion.so" → notion, "foo.co.uk" → foo.
  const secondLevel = parts.length > 2 && /^(co|com|org|net|ac|gov)$/.test(parts[parts.length - 2]!);
  const label = parts[parts.length - (secondLevel ? 3 : 2)] ?? parts[0]!;
  // "getcal.com" → "Cal", "linearapp.com" → "Linear".
  const name = label.replace(/^(get|try|use|join)(?=[a-z]{3,})/, "").replace(/(?<=[a-z]{3,})(app|hq)$/, "") || label;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function sameSite(a: string, b: string): boolean {
  const h = (s: string) => {
    try {
      return new URL(/^https?:/.test(s) ? s : `https://${s}`).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return s.toLowerCase();
    }
  };
  const x = h(a);
  const y = h(b);
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}
