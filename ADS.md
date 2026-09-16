# ADS — Cloaked paid & organic advertising

**Owner:** Hammad Bandukda (design) · **Runs the spend:** Pulkit Gupta + partners
**Scope:** Meta, Google/YouTube, LinkedIn, OOH, organic social. Design ideation, copy, creative specs, audience strategy.
**Companion to:** `CLAUDE.md` (brand, fonts, systems, people). This file is the ads-specific layer.

> **Numbers in §3–§6 are pulled from real sources and dated. Re-pull before quoting them.**
> Meta/Google = PostHog warehouse. LinkedIn = ScalixAI Slack reports (**not** independently verified — see §11).

---

## 1 · How I should work on ads

1. **Pull before opining.** Meta + Google live in PostHog warehouse tables (§11). LinkedIn does not — it's Slack-only.
2. **Separate the hook from the funnel.** High CTR + bad CAC = landing page problem. Low CTR + good CAC = the ad is filtering, leave it alone. Say which one before proposing creative.
3. **Design for the placement that actually gets the money**, not the one that looks best in a case study (§4.3).
4. **One recommendation.** Ad reviews go: what the data says → what I'd change → what I'd leave.
5. **Consumer and enterprise are different products, different craft.** Never reuse consumer creative on LinkedIn or vice versa.
6. **Verify on canvas** after any Figma write (screenshot / read-back), same rule as the rest of the design work.

---

## 2 · Channel map

| Channel | Audience | Who runs it | Scale | Creative source |
|---|---|---|---|---|
| **Meta** (FB/IG/Threads) | Consumer | Pulkit + vendor pods | ~$285K/day | Vendor pods + Hammad statics |
| **Google Search / Demand Gen / YouTube** | Consumer | Pulkit / growth | ~$53K/day (top 25) | Video + image |
| **LinkedIn** | Enterprise (CISO+) | **ScalixAI** (Jerome, Davis, Waqas) | ~$28.6K/mo | Hammad + exec TLAs |
| **OOH** | Consumer, metro | **Conferra** (KJ, Pranjal, Bhagawat) | Boston + Dallas live | Hammad |
| **Organic social** (LinkedIn/X) | Both | **Gosho** (Midori; internal Kat) | — | Gosho + Cloaked |
| **Taboola** | Consumer native | Taboola (Mikayla Lengel) | Exploratory | Can import top Meta ads |

---

## 3 · Consumer — Meta

### 3.1 Economics (45 days to 2026-09-10)

~$12.83M spend · ~74,600 Meta-attributed purchases · **blended CAC $172**

| Campaign | Spend | CTR | CPC | CAC |
|---|---|---|---|---|
| Consolidated Winners | $4.90M | 1.51% | $2.58 | $172 |
| Mindful Testing | $2.11M | 1.04% | $1.85 | $172 |
| Consolidated Winners – Max Conv Value | $1.28M | 1.86% | $4.30 | **$194** ← worst at scale |
| Hypesonic Testing | $935K | 0.80% | $2.51 | **$161** |
| GC Testing | $798K | 1.35% | $1.52 | $171 |
| Consolidated Moved – Cost Cap | $752K | 1.73% | $2.92 | **$147** ← best at scale |
| Trendify New Testing | $727K | 2.53% | $1.55 | $172 |
| Mindful Testing [2] | $386K | 2.20% | $1.35 | $161 |
| Daisy Partnership Testing | $375K | **3.95%** | **$0.92** | $191 |
| Trendify Testing 2026 | $372K | 1.32% | $1.21 | $173 |
| Streettalk Testing | $146K | 2.22% | $1.54 | $191 |

**Benchmarks to judge new creative against:** CAC $172 blended · CTR 1.5% · CPC $2.50 · CPM $39.
Beat $160 CAC = scale it. Above $190 = diagnose before killing.

### 3.2 Structure
Vendor pods test → winners graduate to **Consolidated Winners**. Pods: Mindful, Hypesonic, Trendify, GC, Daisy Partnership, Streettalk. Separate small `MAI_EXPLORE` / `MAI_MORE` campaigns point at buy.cloaked.com by theme (data broker removal, identity protection).

### 3.3 Placement mix — this dictates format (60 days)

| Placement | Spend | CTR | CPM |
|---|---|---|---|
| FB Reels / iPhone | $4.26M | 1.76% | $48.59 |
| FB Reels / Android | $2.64M | 2.34% | $38.31 |
| IG Reels / iPhone | $2.30M | 1.29% | $31.90 |
| FB Feed / iPhone | $1.96M | 2.24% | $40.24 |
| IG Feed / iPhone | $1.86M | 1.14% | $43.20 |
| **FB Feed / Android** | $1.26M | **3.04%** | $36.35 |
| IG Stories / iPhone | $596K | 2.18% | $69.71 |
| **FB Stories / Android** | $138K | **7.85%** | $142.04 |
| **FB Stories / iPhone** | $133K | **5.23%** | $103.44 |

**Share of spend: Reels ~55% · Feed ~34% · Stories ~6% · Desktop ~3%.**

**Design rules that follow:**
- **9:16 vertical video is the primary deliverable.** 1:1 and 4:5 are secondary. Desktop is noise — stop designing for it.
- **Facebook beats Instagram on every comparable slot.** The paying audience is Facebook-native → older, Android-heavy, not design-native. Bigger type, higher contrast, literal visuals, claim in frame one. Trend-native IG styling underperforms here.
- **Android outperforms iPhone on the same placement** (FB Feed 3.04% vs 2.24%). Check legibility on mid-range Android screens, not just an iPhone mock.
- **Facebook Stories is under-exploited** — best CTR in the account by a wide margin on tiny spend. Worth purpose-built 9:16, not a Reels crop.
- **Reels overlay & Marketplace are junk inventory** (0.27–0.43% CTR). Don't design for them.
- Safe zones: keep copy/logo clear of the bottom ~250px on Reels (caption + CTA chrome) and the top ~120px on Stories.

### 3.4 Creative angles in market
- **Spam calls** — "Your number lives, your phone rings this much" · "Spam isn't random, you're for sale" (data-broker listing visual). *Strongest theme across every channel.*
- **Financial risk / fear** — reframe exposed SSN/USIS data as financial exposure (someone opens a credit card in your name). Currently **black/red, deliberately avoids orange**.
- **Budgeting / subscription control** — "Adulting is hard", Monarch/Rocket Money positioning. White/cream or orange/white.
- **Privacy / secure identity** — third Cloaked Pay theme.
- **Cloaked Pay product hook** — virtual cards, merchant locks, spending limits, fraud protection.

### 3.5 Known post-click truths
- 90%+ of onboarding happens on **mobile**. Scan field stays above the fold.
- **Won:** secure-badge variant (clear margin, rolling out) · OTP-page testimonials · checkout comparison list.
- **Weak:** plan picker underperforms. Landing page + checkout/pricing are the main drop-off points.
- **Inconclusive/dead:** loading animation (slightly negative) · no-loader scan (conversion up, ARPU flat).
- Live page test: control vs V17/V18/V19 at 68/10/10/10.

---

## 4 · Consumer — Google & YouTube

45 days, top 25 campaigns ≈ $2.38M.

| Campaign | Type | Spend | CTR | CPA |
|---|---|---|---|---|
| SEARCH – BRAND – Brand Name – Exact | Search | $760K | 31.6% | **$75.52** |
| SEARCH – BRAND – Reviews – Exact | Search | $81K | 19.3% | $79.46 |
| SEARCH – BRAND – Brand Product – Broad | Search | $55K | 15.7% | $84.20 |
| **SEARCH – NB – Feature – Spam Call – Broad** | Search | $130K | 4.62% | **$114.47** |
| **SEARCH – NB – Feature – Spam Call – Exact** | Search | $95K | 4.83% | $118.42 |
| SEARCH – Data removal (Deleteme, how-to, core) | Search | $196K | 3.6–4.7% | $123–128 |
| Demand Gen – Prospecting-Competitors – Video | Demand Gen | $161K | 0.49% | $129.31 |
| Demand Gen – Prospecting-Broad – Video | Demand Gen | $131K | 0.57% | $154.21 |
| ACI Android App Install – Video – CPA | App | $69K | 2.02% | **$2.19** (installs) |
| YouTube_Video views – 20260119 | Video | $158K | 0.05% | **$16,966** |
| YouTube_Video Reach – 20260716 | Video | $45K | 0.05% | $5,032 |

**Reads:**
- **"Spam call" is the best non-brand theme on Google** ($114–118) and beats data removal ($123–128). It's also the best LinkedIn hook. **Spam calls is Cloaked's strongest message across every channel — lead with it.**
- Brand search is huge and cheap ($75 CPA) — that's brand defense, not acquisition. Don't read it as demand gen.
- **$203K in YouTube video-views/reach campaigns returning ~18 conversions.** Either pure awareness buying (fine, but call it that) or broken conversion tracking. Worth asking Pulkit which.
- Demand Gen CTR sits at 0.5% — low even for the format. Thumbnail/first-frame work is the lever.

---

## 5 · Enterprise — LinkedIn (ScalixAI)

### 5.1 Economics (Aug 2026)
$28,647 spend · 19 enterprise leads · **$1,508 per lead** · CTR 0.74% · CPC $11.26 · CPM $92 · audience penetration 20.9%

Sept 7–13: CTR recovered to 0.93%, 5 qualified leads at $1,482.

### 5.2 Funnel structure
- **TOF:** Thought Leader Ads (exec-authored) · video (brand awareness, builds RTG pools)
- **MOF:** single-image product features · document ads · product tutorials
- **BOF:** social proof w/ brand logos · exec/customer TLAs · message ads

**Targeting:** 30K CISO list + LinkedIn Brand Aware audience + Highly Engaged List.

### 5.3 What wins — and it's not close
Two first-person exec hooks carry the entire account:
- **"I get 15–20 spam calls a day"** — 5.15–6.23% CTR, **$0.57–0.66 CPC**
- **"My father asked me for one piece of privacy advice"** — 4.66–5.24% CTR, $0.73–0.74 CPC

Same creative on the Brand Aware List costs **$13.84–18.53** per click. *The audience is the difference, not the creative.*
`BOF | CP Video | RTG` is the most efficient unit in the account — video views at $0.17.
New `TOF | Web Visits | Single Image` (launched 8/28) delivered conversions at $201, best variant $144 (Services Industry).

### 5.4 What loses
- **Gated document / lead-gen forms:** $4,254 for 1 lead in August. 8 form opens from 32 clicks. The form is the bottleneck, not the traffic. Flagged three cycles running.
- **Retargeting pools are exhausted** — frequency 11.38 on CP Video, CTR down 64%.
- **TLAs without CTA links produce clicks and zero site visits.** Two best creatives (576 clicks) drove no landing page traffic because destination URLs were missing.

### 5.5 Enterprise design rules
- Creative that carries: **story-led, first-person, concrete, product-anchored, visible mechanism.** Not stat-led.
- **Drop the "3 billion" stat** from the dashboard ad — use enterprise badges + a product snapshot.
- **No AirPods.** Incentive ads featuring AirPods are out — Crayon: "we don't want to advertise AirPods."
- Crayon's standing note on enterprise statics: *"explore a more empowering graphic — it feels branded but a bit neutral."* Neutral is the failure mode here.
- Single image: **1200×1200**. Enterprise video needs technical depth (destination + CTA still open).
- "Bring Cloaked to work" is the live enterprise campaign concept.

---

## 6 · OOH (Conferra)

Live in **Boston + Dallas**. Formats: static bulletins (14'H × 48'W, 20'×60'), digital spectaculars, downtown kiosks, mobile billboards.

**Hard-won rules from KJ/Bhagawat + Pulkit:**
- **Read time on highway units is 2–3 seconds.** Ruthlessly short copy.
- **"Big font, big logo, tiny man."** Logo is consistently the thing they ask to enlarge — start it larger than feels right.
- Fewer words beats the full story. Pulkit still wants the full story on *some* inventory — confirm per unit.
- Ask **front-lit vs backlit** before finalizing — it changes contrast handling.
- Confirm whether digital units are animation-friendly (Seaport digital was **static only**).
- Check mockup accuracy for edge clipping on spectaculars — this has bitten twice.
- Logomark: no stroke.

---

## 7 · Organic social (Gosho)

LinkedIn + X, weekly reporting to Kat. What lands:
- **Consumer-first, creative, topical** posts outperform product posts. Top performers: "Don't Let Ron Fill Your Library with Smut" (9.6% LinkedIn eng.), Digital Footprint Checklist (18.77%), OpenAI open letter (6.06%), Black Hat content (~8%).
- Recruiting posts spike reach hard ("We're hiring" — 8.78% eng., +164% followers) but don't convert.
- X is smaller; creator-targeted and back-to-school/student messaging is the current push.

---

## 8 · Audiences → design translation

| Audience | Where | What they respond to | Design |
|---|---|---|---|
| **Consumer, broad** | Meta FB Reels/Feed, Android-heavy, older | Spam calls, being "for sale", financial exposure | 9:16, huge type, high contrast, literal, claim in frame 1. Not trend-native. |
| **Consumer, Pay** | Meta + creators + Google | Checkout exposure, virtual cards, budgeting control | Two routes: fear (black/red) and control (cream/orange). Single "Get started" CTA. |
| **Consumer, search intent** | Google Search | "spam calls", "data removal", competitor names | Copy-led. Match the query verbatim in the headline. |
| **Enterprise, CISO+** | LinkedIn TLA, Highly Engaged List | First-person exec story, concrete mechanism, peer logos | Editorial, restrained, badge-led. Never consumer creative. |
| **Enterprise, brand-aware** | LinkedIn BA list | Same creative, 20× the CPC | Don't blame creative here — it's an audience-size problem. |
| **Metro commuter** | OOH Boston/Dallas | One idea, 2–3 seconds | Big logo, big type, minimal copy. |

---

## 9 · Copy patterns

**Winning shape:** first-person + a specific number + a mechanism.
- "I get 15–20 spam calls a day" ← best-performing line Cloaked has.
- "My father asked me for one piece of privacy advice"
- "Spam isn't random — you're for sale"

**Rules:**
- Lead with the symptom the person already notices (spam calls), not the category (data brokers).
- Concrete numbers beat big numbers. "15–20 a day" > "3 billion records".
- Coverage claim is **"1,000+ sites"** — phrase as *sites*, not *data brokers*. `120+` / `130+` / `400+` are stale (see CLAUDE.md §8).
- User count: **600K+** (updated from 500K+ by Rob, Aug 2026) — confirm before publishing.
- Ratings: Google Play 4.6 · Apple 4.5 · Chrome 4.4 · Trustpilot 4.0. Never publish above the live store number (see MAR-240).
- Annual pricing lands at **$9.99/mo**; annual tab is selected by default.

---

## 10 · Brand in an ad context

The site system is cream `#FBF8EF` / ink `#130F02` / brand orange `#FF550C`, Simula (Book) + STK Bureau Sans.

**Live tension:** the financial-fear creative deliberately uses **black/red and avoids orange**.

**Standing position (mine, until overruled):** let performance creative break the *palette*; hold the *type system* constant so it still reads as Cloaked. Fear ads in black/red are fine. Introducing Inter/Lora/Poppins is not — that rule holds in ads too.

**Figma files:**
- **Marketing Board** — `8LWQOqTh7kIMmF0UDn4BLE` — ad variants, LinkedIn ads, reward ads. *Primary ads file.*
- **Cloaked × Spacebar** — `6g92q4d7AOpEnEvlLts2sP` — video/thumbnail partner work.
- **Web Handoff Working File** — `q5z24r77AMyBWvLjrrK1ku` — site, not ads.
- **Weavy** (`app.weavy.ai`) — AI image gen used for marketing campaign assets.

---

## 11 · Measurement — and what's broken

**Where the data lives (PostHog project 45584, warehouse):**
- `metaads_campaign_stats_with_name` — campaign × day. `spend` is String → `toFloatOrZero(toString(spend))`. `actions` is a JSON string; extract purchases with `extract(toString(actions), '"action_type":"omni_purchase","value":"([0-9]+)"')`.
- `metaads_campaign_stats_by_platform` — placement × device. All columns String.
- `googleads_campaign_overview_stats` — cost in `metrics_cost_micros` (÷1,000,000).

**Broken, in priority order:**
1. **Meta `campaign_stats` sync is PAUSED in PostHog** — data was 6 days stale at time of writing. Fix: enable the table at `/data-management/sources/managed-0199ed69-055d-0000-e4b0-79dd1d5d326a/schemas`.
2. **LinkedIn Ads is not connected to PostHog at all.** Every LinkedIn number in §5 is ScalixAI's own reporting, unverified. Connect it, or every enterprise decision runs on the agency's marking of its own homework.
3. **Enterprise form has no hidden UTM fields.** Scalix has asked twice. Without it there is no true cost per enterprise lead.
4. **Enterprise form is being spammed** — 66 submissions in one week, **5 genuine**; 41 from repeat fake identities (`jemie@testing.com`, `john@testing.com`), one submitted 24 times. Needs bot protection before lead-cost numbers mean anything.
5. **YouTube view campaigns show ~$203K for ~18 conversions** — confirm whether that's intentional reach buying or broken tracking.
6. Pay measurement: SKU tagging was preferred over UTM campaign tracking; an experiment tracker is still needed for landing-page tests.

---

## 12 · People

| Who | Role in ads |
|---|---|
| **Pulkit Gupta** | Head of marketing. Runs/approves spend. Final sign-off on creative. |
| **Rob Ednie** | Pushes on lead volume + attribution. Asks the hard "how are we driving leads" questions. |
| **Kat Obermeyer** | Marketing copy owner. Organic social lead (w/ Gosho). |
| **Arjun Bhatnagar** | CEO. Opinion moves decisions. |
| **Michael Abbate** | Taste opinions matter even when not in the room. |
| **Crayon Hsieh** | Design review on ad creative. |
| **Anas Siddiqui** | Static creative references/themes, landing page variants. |
| **Nawab Ali** | Landing page + experiment decisions, thumbnails. |
| **Kyle Adams** | Pay post-checkout onboarding, TOF Pay pages. |
| **ScalixAI** — Jerome de Jesus, Davis, Waqas | LinkedIn enterprise ads agency. |
| **Conferra** — KJ (Kawaljeet), Pranjal Bamb, Bhagawat Rawat | OOH. |
| **Gosho** — Midori | Organic social agency. |
| **Taboola** — Mikayla Lengel | Native. |
| **Spacebar Visuals** — Cody Tran | Video/motion. |

---

## 13 · Open items

- [ ] **Daisy Partnership: best hook in the account (3.95% CTR, $0.92 CPC) at a below-average $191 CAC.** Post-click problem, not creative. Highest-leverage fix on the board.
- [ ] **Don't let anyone kill Hypesonic on CTR** — 0.80% CTR but $161 CAC. It filters.
- [ ] **Diagnose `Consolidated Winners – Max Conv Value`** — $1.28M at $194 CAC and an $80 CPM, worst economics at scale.
- [ ] Build dedicated **Facebook Stories** 9:16 creative (best CTR, ~6% of spend).
- [ ] Two Cloaked Pay paid-social funnels: fear route + budgeting route, static, single "Get started" CTA.
- [ ] LinkedIn: social-proof ads w/ enterprise badges; dashboard ad = badges + product snapshot, **drop "3 billion"**; remove AirPods visual.
- [ ] **Kill or rebuild the LinkedIn gated-document offer** — $4,254 for 1 lead.
- [ ] Add CTA links to every TLA — clicks currently go nowhere.
- [ ] Fix Meta sync, connect LinkedIn Ads, add UTM fields + bot protection to the enterprise form (§11).
- [ ] Confirm the YouTube view-campaign intent with Pulkit.
- [ ] Confirm current user count claim (600K+) before it ships in creative.
- [ ] Resolve the orange-vs-black/red palette question with Pulkit (§10).

---

*Baseline established 2026-09-16 from PostHog (Meta 45d/60d, Google 45d), ScalixAI Slack reports, Granola meeting notes, and Slack channel history. Re-pull numbers before quoting.*
