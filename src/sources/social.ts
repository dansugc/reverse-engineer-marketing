import type { Ctx } from "../context.js";
import { clip, median, perWeek } from "../http.js";

const num = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x.replace(/,/g, "")) : NaN);

export async function collectSocial(ctx: Ctx): Promise<void> {
  const { found, store } = ctx;
  const s = found.socials;
  const manual: Record<string, string | undefined> = {
    organic_tiktok: s.tiktok && `https://www.tiktok.com/@${s.tiktok}`,
    organic_instagram: s.instagram && `https://www.instagram.com/${s.instagram}/`,
    organic_youtube: s.youtube && `https://www.youtube.com/${s.youtube}`,
    organic_x: s.x && `https://x.com/${s.x}`,
    organic_linkedin: s.linkedin && `https://www.linkedin.com/company/${s.linkedin}`,
  };
  if (!ctx.sc) {
    for (const [channel, url] of Object.entries(manual))
      store.unknown({ channel, reason: url ? "Account found but SCRAPECREATORS_API_KEY not set — no stats" : "No account linked from the site", manualCheck: url });
    return;
  }
  // TikTok is often not linked from the site: search for it, accept only strong matches.
  let tiktokMatch: string | undefined;
  if (!s.tiktok && ctx.sc.can(6)) {
    const m = await findTikTok(ctx).catch(() => null);
    if (m) {
      s.tiktok = m.handle;
      tiktokMatch = m.reason;
      manual.organic_tiktok = `https://www.tiktok.com/@${m.handle}`;
    }
  }
  for (const [channel, url] of Object.entries(manual)) if (!url) store.unknown({ channel, reason: "No account linked from the website (they may still have one)" });
  await Promise.allSettled([
    s.tiktok && tiktok(ctx, s.tiktok, tiktokMatch),
    s.instagram && instagram(ctx, s.instagram),
    s.youtube && youtube(ctx, s.youtube),
    s.x && x(ctx, s.x),
    s.linkedin && linkedinCompany(ctx, s.linkedin),
  ]);
}

async function findTikTok(ctx: Ctx): Promise<{ handle: string; reason: string } | null> {
  const { found } = ctx;
  const brand = found.brandName ?? ctx.target.brand;
  if (!brand) return null;
  const res = await ctx.sc!.get<any>("/v1/tiktok/search/users", { query: brand });
  const users = ((res?.user_list ?? []) as any[]).map(u => u.user_info).filter(Boolean);
  const norm = (x: unknown) => String(x ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [platform, handle] of [["Instagram", found.socials.instagram], ["X", found.socials.x]] as const) {
    const hit = handle && users.find(u => norm(u.unique_id) === norm(handle));
    if (hit) return { handle: hit.unique_id, reason: `found by search; handle matches their ${platform} @${handle}` };
  }
  const exact = users.find(u => norm(u.nickname) === norm(brand) && u.custom_verify && norm(u.unique_id).includes(norm(brand)));
  return exact ? { handle: exact.unique_id, reason: `found by search; verified account named "${exact.nickname}" (weak match — confirm)` } : null;
}

async function tiktok(ctx: Ctx, handle: string, matchedBy?: string): Promise<void> {
  const sc = ctx.sc!;
  const [profile, latest, popular] = await Promise.all([
    sc.get<any>("/v1/tiktok/profile", { handle }),
    sc.get<any>("/v3/tiktok/profile/videos", { handle }).catch(() => null),
    sc.get<any>("/v3/tiktok/profile/videos", { handle, sort_by: "popular" }).catch(() => null),
  ]);
  const map = (v: any) => ({ views: num(v.statistics?.play_count), likes: num(v.statistics?.digg_count), shares: num(v.statistics?.share_count), saves: num(v.statistics?.collect_count), created: v.create_time as number, hook: clip(v.desc, 160), isAd: Boolean(v.is_ads), url: v.share_url?.split("?")[0] });
  const recent = ((latest?.aweme_list ?? []) as any[]).map(map);
  const top = ((popular?.aweme_list ?? []) as any[]).map(map).sort((a, b) => b.views - a.views);
  ctx.store.add({
    source: "tiktok",
    kind: "derivation",
    title: `TikTok @${handle}: ${fmt(profile?.stats?.followerCount)} followers, ${fmt(profile?.stats?.videoCount)} videos, ${perWeek(recent.map(r => r.created)) ?? "?"} posts/wk, median ${fmt(median(recent.map(r => r.views)))} views (recent)`,
    url: `https://www.tiktok.com/@${handle}`,
    data: {
      handleSource: matchedBy ?? "linked from website",
      followers: profile?.stats?.followerCount,
      totalLikes: profile?.stats?.heartCount,
      videos: profile?.stats?.videoCount,
      bio: profile?.user?.signature,
      postsPerWeek: perWeek(recent.map(r => r.created)),
      medianViewsRecent: median(recent.map(r => r.views)),
      lastPostDaysAgo: recent[0]?.created ? Math.round((Date.now() / 1000 - Math.max(...recent.map(r => r.created))) / 86_400) : null,
      sparkAdsInRecent: recent.filter(r => r.isAd).length,
      topVideos: top.slice(0, 6),
      recentVideos: recent.slice(0, 6),
    },
  });
}

async function instagram(ctx: Ctx, handle: string): Promise<void> {
  const res = await ctx.sc!.get<any>("/v2/instagram/user/posts", { handle });
  const posts = ((res?.items ?? []) as any[]).map(p => ({
    type: p.product_type === "clips" ? "reel" : p.product_type === "carousel_container" ? "carousel" : "image",
    likes: num(p.like_count),
    comments: num(p.comment_count),
    views: num(p.play_count ?? p.ig_play_count ?? p.view_count),
    created: num(p.taken_at),
    hook: clip(p.caption?.text, 160),
    url: p.url ?? (p.code ? `https://www.instagram.com/p/${p.code}/` : undefined),
  }));
  const followers = num(res?.user?.follower_count);
  ctx.store.add({
    source: "instagram",
    kind: "derivation",
    title: `Instagram @${handle}: ${fmt(followers)} followers, ${perWeek(posts.map(p => p.created)) ?? "?"} posts/wk, median ${fmt(median(posts.map(p => p.likes)))} likes`,
    url: `https://www.instagram.com/${handle}/`,
    data: {
      followers,
      bio: res?.user?.biography,
      postsPerWeek: perWeek(posts.map(p => p.created)),
      formatMix: posts.reduce<Record<string, number>>((m, p) => ((m[p.type] = (m[p.type] ?? 0) + 1), m), {}),
      medianLikes: median(posts.map(p => p.likes)),
      engagementRate: followers > 0 ? Math.round(((median(posts.map(p => p.likes + p.comments)) ?? 0) / followers) * 10_000) / 100 : null,
      topPosts: [...posts].sort((a, b) => b.likes - a.likes).slice(0, 5),
    },
  });
}

async function youtube(ctx: Ctx, ref: string): Promise<void> {
  const sc = ctx.sc!;
  const handle = ref.startsWith("@") ? ref.slice(1) : undefined;
  const channelId = ref.startsWith("channel/") ? ref.slice(8) : undefined;
  const params = channelId ? { channelId } : { handle: handle ?? ref.replace(/^(c|user)\//, "") };
  const ch = await sc.get<any>("/v1/youtube/channel", params);
  const vids = await sc.get<any>("/v1/youtube/channel-videos", { ...params, sort: "popular" }).catch(() => null);
  const top = ((vids?.videos ?? []) as any[]).slice(0, 6).map(v => ({ title: clip(v.title, 140), views: v.viewCountInt, published: v.publishedTime?.slice(0, 10), lengthSeconds: v.lengthSeconds, url: v.url }));
  ctx.store.add({
    source: "youtube",
    kind: "observation",
    title: `YouTube ${ch?.handle ?? ref}: ${fmt(num(ch?.subscriberCount))} subscribers, ${fmt(num(ch?.videoCount))} videos, ${fmt(num(ch?.viewCount))} total views`,
    url: ch?.channel ?? `https://www.youtube.com/${ref}`,
    data: { subscribers: ch?.subscriberCount, videos: ch?.videoCount, views: ch?.viewCount, description: clip(ch?.description, 400), topVideos: top },
  });
}

async function x(ctx: Ctx, handle: string): Promise<void> {
  const sc = ctx.sc!;
  const [profile, tl] = await Promise.all([sc.get<any>("/v1/twitter/profile", { handle }), sc.get<any>("/v1/twitter/user-tweets", { handle }).catch(() => null)]);
  const tweets = ((tl?.tweets ?? []) as any[]).map(t => ({
    text: clip(t.legacy?.full_text, 240),
    likes: num(t.legacy?.favorite_count),
    reposts: num(t.legacy?.retweet_count),
    views: num(t.views?.count),
    created: Date.parse(t.legacy?.created_at) / 1000,
    url: t.url,
  }));
  ctx.store.add({
    source: "x",
    kind: "derivation",
    title: `X @${handle}: ${fmt(profile?.legacy?.followers_count)} followers, ${perWeek(tweets.map(t => t.created)) ?? "?"} posts/wk, median ${fmt(median(tweets.map(t => t.views)))} views`,
    url: `https://x.com/${handle}`,
    data: {
      followers: profile?.legacy?.followers_count,
      bio: profile?.legacy?.description,
      verified: profile?.is_blue_verified,
      postsPerWeek: perWeek(tweets.map(t => t.created)),
      medianViews: median(tweets.map(t => t.views)),
      topPosts: [...tweets].sort((a, b) => b.views - a.views).slice(0, 5),
    },
  });
}

async function linkedinCompany(ctx: Ctx, slug: string): Promise<void> {
  const res = await ctx.sc!.get<any>("/v1/linkedin/company", { url: `https://www.linkedin.com/company/${slug}` });
  if (!res) return;
  ctx.store.add({
    source: "linkedin",
    kind: "observation",
    title: `LinkedIn ${res.name}: ${fmt(res.followers)} followers, ${fmt(res.employeeCount)} employees on LinkedIn, founded ${res.founded ?? "?"}`,
    url: res.url,
    data: {
      followers: res.followers,
      employees: res.employeeCount,
      size: res.size,
      founded: res.founded,
      hq: res.headquarters,
      industry: res.industry,
      funding: res.funding,
      similarPages: (res.similarPages ?? []).slice(0, 10).map((p: any) => p.name),
      employeeSample: (res.employees ?? []).slice(0, 6),
      recentPosts: (res.posts ?? []).slice(0, 5).map((p: any) => ({ date: p.datePublished?.slice(0, 10), text: clip(p.text, 240), url: p.url })),
    },
  });
}

function fmt(n: unknown): string {
  const v = num(n);
  if (!Number.isFinite(v)) return "?";
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}K`;
  return v.toLocaleString("en-US");
}
