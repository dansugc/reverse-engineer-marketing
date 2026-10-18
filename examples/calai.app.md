# How Cal AI gets customers

**One-line verdict:** A paid-social creative factory — ~949 Meta video ads (40/40 active in sample, winners running 137 days) built from influencer/UGC "#ad" footage, all pointed straight at the App Store listing with a 3-day free trial paywall, backed by a 371k-rating App Store asset and a bulk-published SEO blog [E17, E7, E8].

## TL;DR

- **Meta is the engine.** 949 ads in the library, every sampled ad active, every sampled ad VIDEO, every one landing on `itunes.apple.com/app/id6480417616` — no website in the path at all [E17]. The longest-running active ad has been live 137 days with 7 variants [E17]: that's a proven winner, not a test.
- **One hook does the heavy lifting.** The 137-day winner and seven of the eight longest-running ads share the identical body copy — *"AI can now count your calories—just from a photo…"* — under two headline wrappers: *"Limited Time Free Trial 👉"* and *"AI Counts Your Food for You"* [E17]. They scale one message across many creator-shot videos rather than many messages.
- **The creative supply is creators, not a studio.** Newer ads carry "#ad" in the body (*"#ad If you're still typing every meal into MyFitnessPal, you're wasting your time."*) and the homepage leads with "Used by your favorite fitness influencers 👀" [E17, E1]. The brand's own TikTok has 6 followers and 433 median views [E20] — the TikTok distribution is on creator accounts, not the brand handle.
- **The store listing is the landing page.** 371,236 ratings at 4.80★ on iOS and 1M+ installs on Play do the conversion work; the site exists mostly for trial claims, FAQ, legal and blog [E7, E10, E1, E8].
- **Website SEO is a secondary, recently-stuffed asset:** 127 URLs total, 103 of them blog posts, and all 103 updated/published within the last 30 days — a bulk content push, not a programmatic engine (0 programmatic families) [E8].

## Channel scorecard

| Channel | Status | Strength | What we saw | Evidence |
|---|---|---|---|---|
| Paid Meta | active | 3 | 949 ads in library; 40/40 sampled ads active; 4 launched in last 30d; 100% VIDEO; top ad 137 days; all traffic to the iOS App Store listing | E17 |
| App Store / Play | active | 3 | iOS "Cal AI - Calorie Tracker" 371,236 ratings @4.80★, live since 2024-04-08, updated 2026-10-13; Play 1M+ installs | E7, E10 |
| Organic Instagram | active | 3 (audience), weak output | 384,077 followers but 0.8 posts/wk and median 279 likes (0.08% ER) | E21 |
| SEO | active | 2 | 127 indexed URLs, 103-post blog, 103 content updates in 90d, 24 comparison-pattern URLs, 0 programmatic families | E8, E16 |
| Launches | active | 2 | No Hacker News submissions of the domain; the Product Hunt hits returned are Cal.com, a different company — treat as no verified PH presence | E11, E19 |
| Paid Google | dormant | 1 | ~1 video ad pointing at calai.app, 0 shown in last 30d, and it ran under a third-party advertiser "Addressable Media LLC" (2025-10-17→20) | E12 |
| Organic TikTok | active | 1 | @getcalai: 6 followers, 37 videos, 1.8 posts/wk, median 433 views, last post 24 days ago, 0 spark ads in sample | E20 |
| Community | active | 1 | 7 recent threads mention calai.app across r/ProductivityApps, r/Myfitnesspal, r/startups, r/DigitalMarketing and others | E18 |
| Founder-led | dormant | 0 | Zach Yadegari (CEO) has 86,570 X followers; no recent LinkedIn posting captured for any of the three founders | E22 |
| Organic LinkedIn | dormant | 0 | Company page, 54 employees listed, 0 posts in the last 30d sample | E14 |
| Paid LinkedIn | none | 0 | Ad library searched for "Cal AI": no ads; no LinkedIn pixel on site | E13, E3 |
| GEO / AI search | none | 0 | No llms.txt; robots.txt specifies nothing for any AI bot and has 0 disallows | E9 |
| Affiliate | none (visible) | 0 | No affiliate program page found — but ad URLs carry `?trybe=` partner-style tokens (see Funnel) | E4, E17 |
| Sales-led | none | 0 | Self-serve only; no contact-sales, no pricing page on site | E6, E4 |

## The engine

The loop is short and brutally simple:

**Creator video → Meta/Instagram/Threads ad → App Store listing → 3-day free trial → subscription paywall.**

There is no website step. All 40 sampled active ads land on `http://itunes.apple.com/app/id6480417616` with a `trybe=` tracking parameter [E17]. The homepage exists as a brand/trial page ("CLAIM YOUR 3-DAY FREE TRIAL", CTA "Claim My Free Trial") and as a support surface, not as the paid-funnel destination [E1]. Consistent with that, no ad pixels were detected on the homepage at all [E3] — conversion measurement almost certainly happens in-app/SKAN rather than on the web (Inference, based on E3 + the app-store-only landing pattern in E17).

The conversion asset is the listing itself: 371,236 ratings at 4.80★ and a Play listing headlined "#1 calorie counter & nutrition tracker - snap a photo & track calories easily" [E7, E10]. The in-app onboarding is spelled out in the description: "1) Answer lifestyle questions to build your plan 2) Snap a photo of your meal* 3) Get your nutritional breakdown*" with the asterisk disclosing "FOOD SCANNING ANALYSIS RESULTS REQUIRE A SUBSCRIPTION" [E7] — a quiz-style onboarding that ends at a paywall.

Everything else is support: the Instagram audience (384k) acts as social proof and a retargeting pool [E21]; the blog catches search demand around calorie questions [E8, E16]; Reddit threads are organic word of mouth they appear not to be seeding [E18].

## Paid

### Meta (Facebook + Instagram + Threads + Messenger)

**Volume & velocity.** 949 ads in the library for page "Cal AI" (page id 311353912066626, 2,895 likes, linked IG 384,077 followers) [E17]. Of the 40 sampled, 40 were active; 4 launched in the last 30 days [E17]. Derivation: a 949-ad lifetime library with a currently-small launch rate (4/30d) suggests they built a huge creative bank and are now running the proven subset rather than testing hard this month (Inference, E17).

**Proven winners — lead with these.** Longest-running active ads [E17]:

| Days live | Started | Headline | Variants | CTA |
|---|---|---|---|---|
| 137 | 2026-06-03 | "Limited Time Free Trial 👉" | 7 | Learn more |
| 81 | 2026-07-29 | "Limited Time Free Trial 👉" | 7 | Learn more |
| 81 ×5 | 2026-07-29 | "Limited Time Free Trial 👉" | 1 each | Learn more |
| 81 | 2026-07-29 | "AI Counts Your Food for You" | 1 | Download |

Seven of eight longest-running ads launched on the same day (2026-07-29) — a batch launch of the same message across different video assets [E17]. The 137-day and 81-day ads with `variants: 7` indicate dynamic-creative / multi-version testing inside a single winning concept [E17].

**The hooks (quoted exactly).**
1. *"AI can now count your calories—just from a photo. Cal AI turns your camera into a smart tracker, giving you instant nutritional breakdowns so you can hit your goals without wasting time on manual logging."* — the universal body, used by all 8 longest-running ads [E17].
2. *"Limited Time Free Trial 👉"* — the dominant headline/offer wrapper [E17].
3. *"AI Counts Your Food for You"* / *"AI Counts Your Calories for You"* — benefit-restated headline [E17].
4. *"#ad If you're still typing every meal into MyFitnessPal, you're wasting your time."* — launched 2026-09-30; direct competitor-displacement angle inside creator content [E17].
5. *"You Have To Try This"* — curiosity headline on that same competitor ad [E17].

**Angle classification:** the core is *feature demo + time-saving problem/solution* with an *offer* wrapper ("Limited Time Free Trial"); the newest creatives add *competitor comparison* (MyFitnessPal) and *creator testimonial* (#ad) [E17].

**Format & placements.** 100% VIDEO in the sample (40/40) — no image, no carousel [E17]. Placements: Facebook 40, Instagram 40, Threads 40, Messenger 20 [E17]. CTA mix: "Learn more" 28, "Download" 11, "Install now" 1 [E17] — note "Learn more" outnumbers "Download" on app-install traffic, a deliberate softer-click choice (Inference, E17).

**Landing & tracking.** Every sampled ad → `itunes.apple.com/app/id6480417616`, most with `?trybe=` tokens (`bc4fafc1`, `d6d6bc5c`, `20dea1a6`) [E17]. No UTMs were captured because the destination is the App Store, not the site [E17]. The three distinct `trybe` values map to distinct creative clusters — likely a partner/creative attribution scheme rather than UTM-based web tracking (Inference, E17).

**Target:** broad consumer fitness/weight-loss, English, iOS-first (the destination is the iOS listing even though a Play app exists with 1M+ installs) [E17, E10].

### Google

Essentially off: ~1 video creative pointing at calai.app, 0 shown in the last 30 days, first/last shown 2025-10-17 → 2025-10-20, and run by **"Addressable Media LLC"**, not Cal AI [E12]. That's a third-party/agency or affiliate entity, not a brand-owned search programme — flagging it as a brand-attribution gap, not evidence of a Google channel [E12].

### LinkedIn

Checked and empty: no ads for advertiser "Cal AI", and no LinkedIn tag on site [E13, E3]. Correct call for a consumer calorie app.

### TikTok / Reddit paid

Unknown, not absent. No global TikTok ad library exists and no pixels were detected client-side [E3]; given the creator-UGC ad style and the app's demographic, TikTok ads are plausible but unproven (Inference, E17, E3). Manual checks below.

## Organic social

**Instagram @calai.app — big audience, low output.** 384,077 followers; 0.8 posts/week; median 279 likes; engagement rate 0.08%; recent mix 9 reels / 3 images [E21]. The follower base is wildly out of proportion to current engagement — Derivation: 279 median likes on 384k followers means the account is not being fed by the algorithm today; the audience was probably accumulated earlier (and/or via spend) and now functions as social proof and a retargeting pool (Inference, E21, E17).

Top posts [E21]:
- *"Download Cal AI today! The future of calorie tracking 🎯"* — 3,565 likes (image, Feb 2025); the same caption appears on the #2 and #4 posts at 3,551 and 1,638 likes. Three near-identical posts in the same minute = likely a giveaway/launch burst (Inference, E21).
- *"Sorry if I let you down 😞"* — reel, 128,940 views, 1,654 likes. The highest-reach piece in the sample is a personality/confessional hook, not a product demo [E21].
- *"Let's use Cal AI to track the macros in my post gym meal 💪 #protein #macros #gymmotivation #workout"* — reel, 63,611 views [E21]: the straightforward demo-in-context format.

**TikTok @getcalai — not a channel.** 6 followers, 37 videos, 1.8 posts/week, 433 median recent views, last post 24 days ago, 0 spark ads in the recent sample [E20]. The content is competent short-form bait — *"Can AI detect this crispy meal?"* (4,654 views), *"🍝 PASTA vs BURGER 🍔 Which Has More Calories?! 😳"*, *"🍗 KFC vs McDonald's 🍔 Which Has More Calories?! 😳"*, *"420 Calories in ONE Coffee?! ☕😳 Scan It With AI"* [E20] — but with 6 followers it has no owned distribution. Inference: the brand's real TikTok presence runs through creator accounts with "#ad" disclosures that then get licensed into Meta ads, which is exactly what the "#ad" ad bodies suggest (E17, E20, E1).

**Organic → paid reuse:** the ad library's dominant body copy ("AI can now count your calories—just from a photo…") is not what wins on the brand's own organic accounts (comparison/scan-reveal hooks on TikTok, confessional reels on IG) [E17, E20, E21]. So this is not an organic-first testing loop on owned accounts — it's a creator-sourced loop (Inference).

**LinkedIn page:** 54 employees listed, 0 posts in the last 30d sample [E14]. Not a channel.

## SEO & AI search

**Shape.** 127 sitemap URLs: /blog 103, root pages 19, /shop 2 (checkout + order-complete), /ios/login, /jobs/ios-dev [E8]. Zero programmatic page families [E8] — no /x-vs-y or /alternatives/ folder, though pattern-matching finds 24 comparison-style and 4 alternatives-style slugs plus 13 how-tos and 8 listicles inside the blog [E8].

**Cadence.** 103 of 103 blog URLs updated within the last 30 days [E8]. Derivation: either a site migration/bulk re-date or a mass publish — either way the content layer was built or refreshed in one push, not drip-published (Inference, E8).

**Template.** Informational, question-shaped titles aimed at calorie-search demand: `/blog/15,000-steps-calories/`, `/blog/500-calorie-meals-for-weight-loss/`, `/blog/active-calories-vs-total-calories/`, `/blog/active-vs-resting-calories/` [E8]; the blog index lists "Is the Zone Diet Healthy?", "Can You Drink Protein Shakes While Intermittent Fasting", "Why Am I Gaining Weight in a Calorie Deficit?" [E16]. Classic top-of-funnel nutrition Q&A.

**Money pages.** site: results rank the homepage first, then utility/legal pages — forms.calai.app (payment forms), /privacy, /access, /faq, /tos, /sweepstakes, /blog, /groups, /login [E16]. Note two growth-relevant pages surfacing here: **/sweepstakes** ("one automatic entry after they successfully complete and submit a survey") [E16] and **/groups** ("Healthy habits feel easier when you do them with friends. Join groups and stay connected with friends…") [E16] — a survey-incentive mechanic and an in-product social/retention feature.

**AI search.** No llms.txt; robots.txt specifies nothing for GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, Applebot-Extended or Bytespider, and has 0 disallows [E9]. So AI crawlers are unblocked by default but nothing is being done actively to court citations [E9].

## Founders & people

- **Zach Yadegari — Co-Founder & CEO, Cal AI (Apr 2024–present), "Forbes 30 under 30 // CEO of Cal AI // 18 years old"** [E22]. X: @zach_yadegari, **86,570 followers**, bio "19. Forbes 30u30. [link] (acquired) @yourpersona" [E22]. That's a real founder audience — big enough to be a channel — but no recent posts were captured and no LinkedIn posting activity was observed [E22]. Status: dormant in this bundle, not proven absent.
- **Blake W Anderson — "Founder EcoGPT, Cal AI - Forbes 30u30"**, now Co-Founder of EcoGPT since Apr 2026 [E22].
- **Henry Langmack — Co-Founder & CTO, Cal AI, Mar 2024 – May 2026**, now "Cofounder @ Soar" [E22].

Derivation: two of three founders have moved to new ventures and the CEO's X bio contains "(acquired)" [E22] — consistent with the Reddit thread titled "How Cal AI hit $50M ARR and got acquired by MyFitnessPal" [E18]. Treat the ARR and acquisition specifics as **unverified community claims**, not facts; the only first-party-adjacent signal is the "(acquired)" bio string [E22, E18].

Founder-as-brand does not appear in the ad creative — no founder-story angle in any sampled ad [E17].

## Community & launches

- **Reddit:** 7 recent threads mention the domain, spread across r/ProductivityApps, r/CoachingSoftware, r/apps, r/CAIRevolution, r/Myfitnesspal, r/DigitalMarketing and r/startups — one thread per subreddit [E18]. Sentiment is mixed and mostly third-party:
  - *"Tested MyFitnessPal, Cal AI, and meetaugust for a month - honest comparison"* (r/Myfitnesspal, 16 pts, 20 comments) [E18]
  - *"CalAI just got pulled from the App Store — and it exposes a bigger problem with AI calorie tracking"* (r/CoachingSoftware, 11 pts, Apr 2026) [E18] — note the app is currently live and was updated 2026-10-13 [E7], so whatever happened was not permanent.
  - *"Why would people use Cal AI over gpt?"* (r/apps, 16 comments) [E18] — the core objection for this category.
  - *"How Cal AI hit $50M ARR and got acquired by MyFitnessPal"* and *"I will not promote - How did Cal AI do it?"* [E18] — the company has become a growth case study, which is free brand distribution.
  - The highest-scoring thread, *"THEY SHUTTING THE APP/SITE FOREVER?"* (297 pts, r/CAIRevolution) [E18], is from a Character.AI-adjacent subreddit and is probably a false-positive match on "CAI" (Inference, E18).
  - No evidence of founder or brand accounts replying in any thread [E18].
- **Hacker News:** no submissions of the domain [E11]. Expected for a consumer fitness app.
- **Product Hunt:** the returned results — "Cal.com: Scheduling infrastructure…", "Cal.com Reviews (2026)", "Cal ID" — are **Cal.com, a different company** [E19]. No verified Cal AI Product Hunt launch in this bundle.
- **Owned community:** the site has a **/groups** page — in-product friend groups for accountability [E16]. That's retention/virality inside the app rather than an external community.

## Funnel & monetization

- **Entry offer:** 3-day free trial, surfaced as a dedicated homepage section "CLAIM YOUR 3-DAY FREE TRIAL" with CTA "Claim My Free Trial" [E1, E6]. Same offer is the headline of the top ads: "Limited Time Free Trial 👉" [E17].
- **Model:** free app, paid subscription gating the core feature — "FOOD SCANNING ANALYSIS RESULTS REQUIRE A SUBSCRIPTION" [E7]. No pricing page on the website, no free plan, no money-back guarantee, no annual-discount or lifetime messaging found on site [E6]. Payments collected partly off-site at forms.calai.app ("Input your payment details for Cal AI.") [E16].
- **Motion:** 100% self-serve; no contact-sales, no demo, no visitor-identification tags [E6, E4, E3].
- **Onboarding:** quiz-first — "Answer lifestyle questions to build your plan" before the first scan [E7]. That personalisation step is the standard consumer-subscription paywall ramp (Inference, E7).
- **Social proof stack:** homepage says "Used by your favorite fitness influencers 👀", "Over 100k 5-star ratings", "Thousands of users talk about us", "5M users with ⭐ 4" [E1]; IG bio repeats "⭐️ Over 5 million happy users" [E21]; the store evidence supports it with 371,236 ratings @4.80★ [E7].
- **Incentive mechanic:** a sweepstakes with "one automatic entry after they successfully complete and submit a survey" [E16] — survey completion bought with a prize draw, likely for research and/or list building (Inference, E16).
- **Lifecycle:** no email/CRM tool visible client-side; only GA4 (G-3DR33124SR) [E4]. Unknown, not absent — for an app, lifecycle usually runs via push/server-side.
- **Affiliate:** no program page found [E4], but every ad URL carries a `trybe=` token [E17] and a third-party advertiser ran a Google video ad for the domain [E12]. Likely some partner/creator attribution layer exists that isn't publicly documented (Inference, E17, E12).
- **Refund friction (notable):** the live homepage now carries two CTAs that didn't exist in April 2026 — "Request a refund from Apple" and "Request your Google Play refund" [E1, E15]. Likely a response to subscription-refund pressure or a consumer-protection requirement (Inference, E15).

## Positioning over time

- **2022-04-09:** calai.app was a different product — "Calai app - Home", "Distraction free calendar. Keep organised without the clutter.", CTA "Join the Waitlist" [E15]. The domain was repurposed/acquired before the calorie app launched (app first released 2024-04-08) [E15, E7].
- **2024-10-03:** "Track your calories with just a picture." with a long descriptive meta ("Snap a photo or scan a barcode, and Cal AI instantly calculates calories and nutrients…") and a single CTA: **Download** [E15]. Pure install pitch.
- **2025-10-10:** H1 becomes "Meet Cal AI Track your calories with just a picture" and the CTA switches to **"Claim My Free Trial"** [E15]. Derivation: the offer moved from "download" to "trial" — that's the monetisation step being pulled forward, and it matches the ad headline "Limited Time Free Trial 👉" running today [E15, E17].
- **2026-04-08:** unchanged [E15].
- **2026-10-03:** same pitch, but refund-request CTAs added [E15]. Inference: growth messaging is frozen; the site changes now are operational/compliance, consistent with a company post-acquisition where the paid engine runs on autopilot (E15, E22, E18).

## Steal this playbook

1. **Put the App Store listing, not your website, behind the ad click.** All 40 sampled active ads go to `itunes.apple.com/app/id6480417616` with a tracking token [E17]. If your conversion is an install, remove the web step. Budget the saved effort into store screenshots and ratings instead [E7].
2. **Write one body of copy and scale it across 40+ videos.** Cal AI runs the identical paragraph — *"AI can now count your calories—just from a photo…"* — under every long-running winner [E17]. Find your one sentence, then vary only the footage and the headline wrapper.
3. **Use two headline wrappers: offer and benefit.** "Limited Time Free Trial 👉" (offer) vs "AI Counts Your Food for You" (benefit) [E17]. Run both against the same body; the offer wrapper owns 7 of the 8 longest-running slots in this sample [E17].
4. **Buy creator footage with #ad disclosure and run it as brand ads.** The newest creatives carry "#ad" and name a competitor: *"#ad If you're still typing every meal into MyFitnessPal, you're wasting your time."* [E17]. Target 4–8 new creator videos per month to match their recent launch rate (4 in the last 30 days) [E17], and whitelist the strongest into the account.
5. **Launch in batches, then let winners run.** Seven of the eight longest-running ads started on the same day (2026-07-29) and are still live 81 days later [E17]. Ship a cohort, kill fast, and leave the survivors untouched for 90+ days.
6. **Use dynamic variants inside the winner.** The 137-day ad has 7 variants under one ad [E17] — copy/thumbnail permutations inside a proven concept, not new concepts.
7. **Run VIDEO-only across FB + IG + Threads + Messenger.** 40/40 sampled ads are video and all four placements are enabled on every one (Messenger on 20) [E17]. Don't bother with static for this motion.
8. **Move the homepage CTA from "Download" to "Claim My Free Trial".** Cal AI made that exact swap between Oct 2024 and Oct 2025 and still runs it [E15, E1]. Pair it with a hard proof block: "Over 100k 5-star ratings" + "5M users" [E1].
9. **Ship ~100 question-shaped blog posts in one push, not 2/week.** Their entire SEO asset is 103 posts targeting queries like "active calories vs total calories" and "500 calorie meals for weight loss" [E8]. Mix how-tos (13) and listicles (8) and comparison-shaped titles (24) [E8].
10. **Add a survey-for-sweepstakes entry and in-app friend groups.** "/sweepstakes": one entry per completed survey [E16]; "/groups": "Healthy habits feel easier when you do them with friends" [E16] — one feeds research/list, the other feeds retention and invites.

## Unknowns & how to check

- **TikTok paid.** No global ad library API, and no TikTok pixel was detected client-side [E3]. Given 100%-video creator ads [E17], TikTok ads are plausible. Check: https://library.tiktok.com/ads?region=all&adv_name=Cal%20AI and the TikTok Creative Center.
- **Reddit paid.** Reddit's ad library is shut down; no Reddit pixel detected [E3]. Check community chatter manually: https://www.reddit.com/search/?q=Cal%20AI
- **Why no pixels at all?** Zero ad pixels and only GA4 on the homepage [E3, E4] despite 949 Meta ads [E17]. Likely MMP/SKAN-based in-app measurement, but no attribution SDK was observed. Check the app binary / AppsFlyer-Adjust-Branch link domains, and inspect calai.app in a real browser with a tag scanner.
- **The `trybe=` parameter.** Appears on every ad URL with at least three distinct values [E17]. Unknown whether it's an internal creative ID or a partner/affiliate platform. Check: resolve `itunes.apple.com/app/id6480417616?trybe=bc4fafc1` and look for a partner-program page or a `trybe` vendor.
- **Google Ads under "Addressable Media LLC."** One video, 0 shown in 30d [E12]. Unknown whether this is an agency, affiliate or unrelated bidder. Check: https://adstransparency.google.com/advertiser/AR08770828289406140417
- **Product Hunt.** The bundle's PH results are Cal.com, not Cal AI [E19]. Check directly: https://www.producthunt.com/search?q=Cal%20AI
- **YouTube and X brand accounts.** Not linked from the website, so unknown — not absent. Check by hand.
- **Founder X activity.** Zach Yadegari has 86,570 X followers but no posts were captured [E22]. Check https://x.com/zach_yadegari for cadence and whether launches route through it.
- **The $50M ARR / MyFitnessPal acquisition claim.** Only evidence is a Reddit thread title and an "(acquired)" string in an X bio [E18, E22]. Unverified — check press releases and the App Store seller record ("Viral Development LLC") for a change of ownership [E7].
- **Lifecycle/email.** Nothing visible client-side [E4]; most of it would be push + server-side. Check: install the app and log the first 14 days of push/email.
- **Android paid.** Play shows 1M+ installs [E10] but every sampled ad points at the iOS listing [E17]. Check the Meta library filtered by country/placement for Android-destination creatives.

---

## Evidence

- **[E1]** Homepage positioning: "Meet Cal AI Track your calories with just a picture" — <https://calai.app/>
- **[E2]** Linked channels: linkedin, instagram, tiktok — <https://calai.app/>
- **[E3]** No ad pixels detected on homepage (or loaded server-side) — <https://calai.app/>
- **[E4]** Marketing stack: Google Analytics 4 — <https://calai.app/>
- **[E5]** Key pages found: blog — <https://calai.app/>
- **[E6]** _(derived)_ Monetization: 3-day trial — <https://calai.app/>
- **[E7]** App Store: Cal AI - Calorie Tracker — 371,236 ratings, 4.80★ — <https://apps.apple.com/us/app/cal-ai-calorie-tracker/id6480417616?uo=4>
- **[E8]** _(derived)_ Sitemap: 127 URLs, 0 programmatic page families, 103 content updates in 90d — <http://calai.app/sitemap-index.xml>
- **[E9]** AI-search stance: no llms.txt; no AI bots blocked — <https://calai.app/robots.txt>
- **[E10]** Google Play: Cal AI - Food Calorie Tracker — 1M+ downloads — <https://play.google.com/store/apps/details?id=com.viraldevelopment.calai&hl=en_US>
- **[E11]** No Hacker News submissions of the domain — <https://hn.algolia.com/?query=calai.app>
- **[E12]** Google ads: ~1 ads pointing at calai.app (0 shown in last 30d), formats video — <https://adstransparency.google.com/?region=anywhere&domain=calai.app>
- **[E13]** LinkedIn ads: none found for advertiser "Cal AI" — <https://www.linkedin.com/ad-library/search?accountOwner=Cal%20AI>
- **[E14]** LinkedIn Cal AI: ? followers, 54 employees on LinkedIn, founded ? — <https://www.linkedin.com/company/cal-ai-app>
- **[E15]** Homepage history: first archived 2022-04-09, 24 monthly snapshots — <https://web.archive.org/web/*/calai.app>
- **[E16]** Top Google results for site:calai.app — <https://www.google.com/search?q=site:calai.app>
- **[E17]** Meta ads: 949 ads in library (40 active in sample of 40), 4 launched in last 30d — <https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=311353912066626>
- **[E18]** Reddit: 7 recent threads mention calai.app (top r/ProductivityApps) — <https://www.reddit.com/search/?q=calai.app>
- **[E19]** Product Hunt presence: Cal.com: Scheduling infrastructure for absolutely everyone; Cal.com Reviews (2026) - Product Hunt; Cal ID: Schedule and monetize meetings for free - Product H… — <https://www.producthunt.com/products/cal>
- **[E20]** _(derived)_ TikTok @getcalai: 6 followers, 37 videos, 1.8 posts/wk, median 433 views (recent) — <https://www.tiktok.com/@getcalai>
- **[E21]** _(derived)_ Instagram @calai.app: 384K followers, 0.8 posts/wk, median 279 likes — <https://www.instagram.com/calai.app/>
- **[E22]** Founders/leaders: Zach Yadegari, X 86,570; Blake W Anderson; Henry Langmack — <https://www.google.com/search?q=%22Cal%20AI%22%20founder%20site%3Alinkedin.com%2Fin>

<sub>Generated by [reverse-engineer-marketing](https://github.com/dansugc/reverse-engineer-marketing) v0.1.0 · harness v1 (fbd47e39dca9) · 2026-10-18 · 19 Scrape Creators credits</sub>
