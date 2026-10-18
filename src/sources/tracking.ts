// Tag/pixel signatures. A pixel on the page is the strongest free signal that
// a company buys traffic on that platform (you don't install the Reddit pixel
// for fun). IDs are extracted where the snippet exposes them so you can match
// a pixel across a company's other sites.

export type TagCategory =
  | "ads_pixel"
  | "analytics"
  | "tag_manager"
  | "attribution"
  | "affiliate"
  | "email"
  | "chat"
  | "experimentation"
  | "visitor_id"
  | "sales"
  | "reviews"
  | "payments"
  | "site_builder";

interface Signature {
  id: string;
  name: string;
  category: TagCategory;
  /** What this tag implies about the marketing motion. */
  implies?: string;
  patterns: RegExp[];
  idPattern?: RegExp;
}

const SIGNATURES: Signature[] = [
  // Ad pixels → paid channels
  { id: "meta_pixel", name: "Meta Pixel", category: "ads_pixel", implies: "paid_meta", patterns: [/connect\.facebook\.net\/[^"']*fbevents\.js/i, /fbq\(\s*['"]init['"]/], idPattern: /fbq\(\s*['"]init['"]\s*,\s*['"](\d{8,20})['"]/g },
  { id: "google_ads", name: "Google Ads conversion tag", category: "ads_pixel", implies: "paid_google", patterns: [/\bAW-\d{9,11}\b/, /googleadservices\.com\/pagead\/conversion/i], idPattern: /\b(AW-\d{9,11})\b/g },
  { id: "tiktok_pixel", name: "TikTok Pixel", category: "ads_pixel", implies: "paid_tiktok", patterns: [/analytics\.tiktok\.com/i, /ttq\.load\(/], idPattern: /ttq\.load\(\s*['"]([A-Z0-9]{10,30})['"]/g },
  { id: "linkedin_insight", name: "LinkedIn Insight Tag", category: "ads_pixel", implies: "paid_linkedin", patterns: [/snap\.licdn\.com\/li\.lms-analytics/i, /_linkedin_partner_id/], idPattern: /_linkedin_partner_id\s*=\s*['"]?(\d{4,12})/g },
  { id: "x_pixel", name: "X (Twitter) Pixel", category: "ads_pixel", implies: "paid_x", patterns: [/static\.ads-twitter\.com\/uwt\.js/i, /twq\(\s*['"](config|init)['"]/], idPattern: /twq\(\s*['"](?:config|init)['"]\s*,\s*['"]([a-z0-9]{4,10})['"]/gi },
  { id: "reddit_pixel", name: "Reddit Pixel", category: "ads_pixel", implies: "paid_reddit", patterns: [/redditstatic\.com\/ads\/pixel\.js/i, /rdt\(\s*['"]init['"]/], idPattern: /rdt\(\s*['"]init['"]\s*,\s*['"]([at]2_[a-z0-9]+)['"]/gi },
  { id: "pinterest_tag", name: "Pinterest Tag", category: "ads_pixel", implies: "paid_pinterest", patterns: [/s\.pinimg\.com\/ct\/core\.js/i, /pintrk\(\s*['"]load['"]/], idPattern: /pintrk\(\s*['"]load['"]\s*,\s*['"](\d{8,16})['"]/g },
  { id: "snap_pixel", name: "Snap Pixel", category: "ads_pixel", implies: "paid_snapchat", patterns: [/sc-static\.net\/scevent\.min\.js/i, /snaptr\(\s*['"]init['"]/] },
  { id: "bing_uet", name: "Microsoft Ads UET", category: "ads_pixel", implies: "paid_microsoft", patterns: [/bat\.bing\.com\/bat\.js/i] },
  { id: "quora_pixel", name: "Quora Pixel", category: "ads_pixel", implies: "paid_quora", patterns: [/a\.quora\.com\/qevents\.js/i] },
  { id: "google_dv360", name: "Google Floodlight / DV360", category: "ads_pixel", implies: "paid_programmatic", patterns: [/fls\.doubleclick\.net/i, /\bDC-\d{6,10}\b/] },
  { id: "apple_search_ads", name: "Apple Search Ads attribution", category: "attribution", implies: "paid_apple", patterns: [/searchads\.apple\.com/i] },

  // Tag managers (we also fetch GTM containers to see pixels hidden inside)
  { id: "gtm", name: "Google Tag Manager", category: "tag_manager", patterns: [/googletagmanager\.com\/gtm\.js/i, /\bGTM-[A-Z0-9]{4,9}\b/], idPattern: /\b(GTM-[A-Z0-9]{4,9})\b/g },
  { id: "segment", name: "Segment", category: "tag_manager", patterns: [/cdn\.segment\.com\/analytics\.js/i, /analytics\.load\(\s*['"][A-Za-z0-9]{20,}/] },
  { id: "rudderstack", name: "RudderStack", category: "tag_manager", patterns: [/cdn\.rudderlabs\.com/i] },

  // Analytics
  { id: "ga4", name: "Google Analytics 4", category: "analytics", patterns: [/googletagmanager\.com\/gtag\/js\?id=G-/i, /gtag\(\s*['"]config['"]\s*,\s*['"]G-/], idPattern: /\b(G-[A-Z0-9]{6,12})\b/g },
  { id: "posthog", name: "PostHog", category: "analytics", patterns: [/posthog\.init\(/, /[a-z]+\.i\.posthog\.com/i, /app\.posthog\.com/i] },
  { id: "amplitude", name: "Amplitude", category: "analytics", patterns: [/cdn\.amplitude\.com/i, /amplitude\.getInstance\(/] },
  { id: "mixpanel", name: "Mixpanel", category: "analytics", patterns: [/cdn\.mxpnl\.com/i, /mixpanel\.init\(/] },
  { id: "hotjar", name: "Hotjar", category: "analytics", patterns: [/static\.hotjar\.com/i] },
  { id: "clarity", name: "Microsoft Clarity", category: "analytics", patterns: [/clarity\.ms\/tag/i] },
  { id: "plausible", name: "Plausible", category: "analytics", patterns: [/plausible\.io\/js/i] },
  { id: "fathom", name: "Fathom", category: "analytics", patterns: [/cdn\.usefathom\.com/i] },
  { id: "heap", name: "Heap", category: "analytics", patterns: [/cdn\.heapanalytics\.com/i] },
  { id: "vercel_analytics", name: "Vercel Analytics", category: "analytics", patterns: [/\/_vercel\/insights/i] },

  // Mobile attribution → app install campaigns
  { id: "appsflyer", name: "AppsFlyer", category: "attribution", implies: "app_install_ads", patterns: [/onelink\.me/i, /appsflyer/i] },
  { id: "branch", name: "Branch", category: "attribution", implies: "app_install_ads", patterns: [/cdn\.branch\.io/i, /\.app\.link\//i] },
  { id: "adjust", name: "Adjust", category: "attribution", implies: "app_install_ads", patterns: [/\badj\.st\//i, /app\.adjust\.com/i] },
  { id: "singular", name: "Singular", category: "attribution", implies: "app_install_ads", patterns: [/sng\.link/i] },

  // Affiliate / referral programs
  { id: "rewardful", name: "Rewardful", category: "affiliate", implies: "affiliate", patterns: [/r\.wdfl\.co/i, /rewardful/i] },
  { id: "firstpromoter", name: "FirstPromoter", category: "affiliate", implies: "affiliate", patterns: [/firstpromoter/i] },
  { id: "partnerstack", name: "PartnerStack", category: "affiliate", implies: "affiliate", patterns: [/partnerstack/i] },
  { id: "tolt", name: "Tolt", category: "affiliate", implies: "affiliate", patterns: [/cdn\.tolt\.io/i] },
  { id: "impact", name: "impact.com", category: "affiliate", implies: "affiliate", patterns: [/impactradius|impact-ad\.|utt\.impactcdn/i] },
  { id: "dub", name: "Dub Partners", category: "affiliate", implies: "affiliate", patterns: [/dubcdn\.com|@dub\/analytics/i] },
  { id: "growsurf", name: "GrowSurf (referrals)", category: "affiliate", implies: "referral", patterns: [/growsurf/i] },
  { id: "viral_loops", name: "Viral Loops (referrals)", category: "affiliate", implies: "referral", patterns: [/viral-loops|viralloops/i] },

  // Email / lifecycle
  { id: "hubspot", name: "HubSpot", category: "email", implies: "lifecycle", patterns: [/js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/i] },
  { id: "klaviyo", name: "Klaviyo", category: "email", implies: "lifecycle", patterns: [/static\.klaviyo\.com/i] },
  { id: "mailchimp", name: "Mailchimp", category: "email", implies: "lifecycle", patterns: [/chimpstatic\.com|list-manage\.com/i] },
  { id: "customerio", name: "Customer.io", category: "email", implies: "lifecycle", patterns: [/assets\.customer\.io/i] },
  { id: "kit", name: "Kit (ConvertKit)", category: "email", implies: "lifecycle", patterns: [/convertkit\.com|\.ck\.page/i] },
  { id: "beehiiv", name: "beehiiv", category: "email", implies: "newsletter", patterns: [/embeds\.beehiiv\.com|beehiiv\.com\/subscribe/i] },
  { id: "loops", name: "Loops", category: "email", implies: "lifecycle", patterns: [/app\.loops\.so/i] },
  { id: "braze", name: "Braze", category: "email", implies: "lifecycle", patterns: [/js\.appboycdn\.com|sdk\.iad-\d+\.braze\.com/i] },
  { id: "iterable", name: "Iterable", category: "email", implies: "lifecycle", patterns: [/iterable\.com\/api|js\.iterable\.com/i] },

  // Chat
  { id: "intercom", name: "Intercom", category: "chat", patterns: [/widget\.intercom\.io|js\.intercomcdn\.com/i] },
  { id: "crisp", name: "Crisp", category: "chat", patterns: [/client\.crisp\.chat/i] },
  { id: "drift", name: "Drift", category: "chat", implies: "sales_led", patterns: [/js\.driftt\.com/i] },
  { id: "zendesk", name: "Zendesk", category: "chat", patterns: [/static\.zdassets\.com/i] },

  // Visitor identification → outbound / ABM motion
  { id: "rb2b", name: "RB2B", category: "visitor_id", implies: "sales_led", patterns: [/rb2b\.com/i] },
  { id: "warmly", name: "Warmly", category: "visitor_id", implies: "sales_led", patterns: [/warmly\.ai/i] },
  { id: "koala", name: "Koala", category: "visitor_id", implies: "sales_led", patterns: [/getkoala\.com/i] },
  { id: "clearbit", name: "Clearbit Reveal", category: "visitor_id", implies: "sales_led", patterns: [/tag\.clearbitscripts\.com|reveal\.clearbit\.com/i] },
  { id: "6sense", name: "6sense", category: "visitor_id", implies: "sales_led", patterns: [/j\.6sc\.co/i] },
  { id: "demandbase", name: "Demandbase", category: "visitor_id", implies: "sales_led", patterns: [/tag\.demandbase\.com/i] },
  { id: "leadfeeder", name: "Leadfeeder / Dealfront", category: "visitor_id", implies: "sales_led", patterns: [/lftracker|sc\.lfeeder\.com/i] },
  { id: "apollo", name: "Apollo website visitors", category: "visitor_id", implies: "sales_led", patterns: [/assets\.apollo\.io\/micro\/website-tracker/i] },

  // Sales tooling
  { id: "calendly", name: "Calendly", category: "sales", implies: "sales_led", patterns: [/calendly\.com\//i] },
  { id: "calcom", name: "Cal.com", category: "sales", implies: "sales_led", patterns: [/cal\.com\/[a-z0-9-]+/i] },
  { id: "chilipiper", name: "Chili Piper", category: "sales", implies: "sales_led", patterns: [/chilipiper\.com/i] },

  // Experimentation
  { id: "optimizely", name: "Optimizely", category: "experimentation", patterns: [/cdn\.optimizely\.com/i] },
  { id: "vwo", name: "VWO", category: "experimentation", patterns: [/visualwebsiteoptimizer\.com/i] },
  { id: "statsig", name: "Statsig", category: "experimentation", patterns: [/statsig/i] },
  { id: "growthbook", name: "GrowthBook", category: "experimentation", patterns: [/growthbook/i] },

  // Social proof
  { id: "trustpilot", name: "Trustpilot widget", category: "reviews", patterns: [/widget\.trustpilot\.com/i] },
  { id: "g2", name: "G2 badge", category: "reviews", patterns: [/g2\.com\/products|g2crowd/i] },
  { id: "senja", name: "Senja testimonials", category: "reviews", patterns: [/senja\.io/i] },
  { id: "testimonial_to", name: "Testimonial.to", category: "reviews", patterns: [/testimonial\.to/i] },
  { id: "producthunt_badge", name: "Product Hunt badge", category: "reviews", implies: "launches", patterns: [/api\.producthunt\.com\/widgets\/embed-image/i] },

  // Payments
  { id: "stripe", name: "Stripe", category: "payments", patterns: [/js\.stripe\.com/i, /buy\.stripe\.com/i] },
  { id: "paddle", name: "Paddle", category: "payments", patterns: [/cdn\.paddle\.com/i] },
  { id: "lemonsqueezy", name: "Lemon Squeezy", category: "payments", patterns: [/lemonsqueezy\.com/i] },
  { id: "shopify", name: "Shopify", category: "payments", patterns: [/cdn\.shopify\.com/i] },

  // Site builder
  { id: "webflow", name: "Webflow", category: "site_builder", patterns: [/data-wf-site|assets\.website-files\.com|cdn\.prod\.website-files\.com/i] },
  { id: "framer", name: "Framer", category: "site_builder", patterns: [/framerusercontent\.com|framer\.com\/m\//i] },
  { id: "wordpress", name: "WordPress", category: "site_builder", patterns: [/\/wp-content\//i] },
  { id: "nextjs", name: "Next.js", category: "site_builder", patterns: [/\/_next\/static\//i] },
  { id: "wix", name: "Wix", category: "site_builder", patterns: [/static\.wixstatic\.com/i] },
  { id: "squarespace", name: "Squarespace", category: "site_builder", patterns: [/static1\.squarespace\.com/i] },
];

export interface DetectedTag {
  id: string;
  name: string;
  category: TagCategory;
  implies?: string;
  ids: string[];
  /** Where we saw it: "page" or a GTM container id. */
  foundIn: string[];
}

export function detectTags(text: string, foundIn = "page"): DetectedTag[] {
  const out: DetectedTag[] = [];
  for (const s of SIGNATURES) {
    if (!s.patterns.some(p => p.test(text))) continue;
    const ids = new Set<string>();
    if (s.idPattern) for (const m of text.matchAll(s.idPattern)) if (m[1]) ids.add(m[1]);
    out.push({ id: s.id, name: s.name, category: s.category, implies: s.implies, ids: [...ids].slice(0, 5), foundIn: [foundIn] });
  }
  return out;
}

export function mergeTags(...lists: DetectedTag[][]): DetectedTag[] {
  const by = new Map<string, DetectedTag>();
  for (const list of lists)
    for (const t of list) {
      const cur = by.get(t.id);
      if (!cur) by.set(t.id, { ...t, ids: [...t.ids], foundIn: [...t.foundIn] });
      else {
        cur.ids = [...new Set([...cur.ids, ...t.ids])].slice(0, 5);
        cur.foundIn = [...new Set([...cur.foundIn, ...t.foundIn])];
      }
    }
  return [...by.values()];
}
