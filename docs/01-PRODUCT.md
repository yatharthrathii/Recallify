# 01 — Product

## Thesis

> **Recallify is Anki's algorithm, made visible.**

Every serious spaced-repetition app hides its scheduler. Anki runs FSRS by default
since 2023 and shows the user almost nothing about it. Quizlet's scheduling is
shallow. Mochi and RemNote paywall the interesting parts.

Recallify's bet: **the algorithm is the product, so show it.**

- Why is this card in front of me right now?
- How fast am I actually forgetting it?
- What does raising my retention target from 85% to 92% cost me in daily reviews?
- Do my own review logs say the default parameters fit me?

No competitor answers these. That is the entire differentiator, and it happens to
be the part that is interesting to build.

## What this is honestly for

This is a portfolio artifact first and a usable product second. Both statements
must stay true:

1. Everything the README claims is verifiable by clicking a link.
2. Nothing is described as novel that already exists elsewhere.

We will not beat Anki. We are not trying to. The README says so plainly.

## Competitive landscape

| App | Scheduler | Offline | AI | Cost | Weakness we exploit |
|---|---|---|---|---|---|
| **Anki** | FSRS (default since 2023), SM-2 | Full, local-first | None native | Free desktop / $24.99 iOS | UX is hostile; algorithm invisible |
| **Quizlet** | Shallow SRS | Cloud-only | Weak | Freemium | Not a real SRS |
| **RemNote** | Notes + SRS integrated | Cloud-first | Some | Free (50 rems) / $8/mo | Complex; paywalled |
| **Mochi** | Clean SRS, Markdown | Cloud-first | Limited | $5/mo | Small; paywalled |
| **Brainscape** | Confidence-Based Repetition (1-5) | Cloud-first | None | Freemium | Not FSRS; curated-deck focused |

### The four real gaps

1. **Explainability** — nobody shows the user their own memory model. *(our headline)*
2. **Offline + modern UX together** — Anki has offline and bad UX; the cloud apps
   have decent UX and no offline. Nobody has both.
3. **AI generation from your own material** — Anki has none natively.
4. **Free and open** — three of five competitors paywall core features.

## Feature set

### Tier 1 — Core. Without these the claims are false.

| # | Feature | Notes |
|---|---|---|
| 1 | FSRS scheduling (D/S/R state machine) | `packages/fsrs`, pure, zero-dep |
| 2 | Review submission → next due date | Append-only `Review` log |
| 3 | Deck + card CRUD | |
| 4 | Own auth: JWT access + rotating refresh | No Firebase |
| 5 | AI card generation (topic or pasted text) | Zod-validated structured output, per-user cap |
| 6 | Quiz/review runs on the user's own cards | Delete `dummyData` |

### Tier 2 — The signature. This is what people remember.

| # | Feature | Why it matters |
|---|---|---|
| 7 | **Forgetting curve** per card + per deck | Visual centrepiece. Proves the algorithm is real |
| 8 | **"Why this card?" panel** | S=12.4d, R=87%, last seen 8d ago, predicted forget date. **Nobody does this** |
| 9 | **Retention target slider** | 85% → 92% shows the workload cost live. Interactive proof of the model |
| 10 | **FSRS parameter optimizer** | Trains on the user's own review log. The hardest, best part |
| 11 | **Backtest / before-after** | Measured: calibration error roughly halves, and intervals move in whichever direction the user actually needs |
| 12 | Keyboard-only review | space=flip, 1-4=rate, u=undo, ?=help |

### Tier 3 — Cheap, high recruiter value.

| # | Feature |
|---|---|
| 13 | Live Swagger/OpenAPI at a public URL |
| 14 | `docker compose up` brings the whole stack up |
| 15 | Review heatmap (contribution-graph style) |
| 16 | Workload forecast — "next 30 days you'll have N due" |
| 17 | Demo account with realistic seeded history — **highest ROI item in this doc** |
| 18 | Command palette (Cmd/Ctrl-K) |
| 19 | CSV import/export |
| 20 | PWA — installable, offline review |

### Tier 4 — After web is live.

| # | Feature | Phase |
|---|---|---|
| 21 | **Anki `.apkg` import** — the door an existing Anki user walks in through | 8 |
| 22 | **Memory Report** — the optimizer's output, made readable | 8 |
| 23 | Android app, full feature parity, offline-first | 9 |
| 24 | Public/shareable decks | later |
| 25 | Leech detection + AI rewrite of failing cards | later |

### Explicitly NOT building

Payments · real-time collaboration · social feed / leaderboards · i18n ·
microservices · chat · in-app notifications infra · desktop app.

Each eats scope and returns no hiring signal.

## On charging money

**Nothing here is built, and none of it is why the project exists.** It is
written down so the phases that come before it do not have to be unpicked later.

### What the market actually looks like

Checked, not assumed:

- Anki is free on desktop and Android, is 19 years old, uses FSRS by default,
  and picked up institutional backing in February 2026. It is not going to be
  out-competed on features by a side project.
- The money in this category is in **content**, not schedulers. AnkiHub sells a
  medical deck subscription (~$6/mo, plus a $450 lifetime tier) to 154,000
  subscribers, on top of software that is free. McGraw Hill partnered with them.
- Paywalls are expensive here: Knowt added one in May 2026 and fell from #5 to
  #61 in the App Store in four days.
- Median revenue for a solo developer on an app store is under $1,000/month.
  The top quartile reaches $3-15k, after 12-18 months, with a narrow niche and
  a subscription.
- Ads need six-figure monthly users to matter. This will not have those.

### The rule that matters most

> **The forgetting curve, "why this card?", the retention slider and the
> optimizer stay free. Permanently.**

They are the entire reason anyone would choose this over Anki. Putting them
behind a payment would remove the differentiator in order to sell it, and the
Knowt number is what that costs.

### What may reasonably be charged for

| | Why it is defensible |
|---|---|
| **AI generation above a free monthly allowance** | It is the one feature with a real marginal cost. Charging for it is honest; the free tier stays usable |
| **The Memory Report (phase 8)** | Analysis nobody else sells, built on the optimizer. Free summary, paid full report |
| **Convenience** — multi-device sync, `.apkg` export | Standard, and none of it is the product's point |

Anything beyond that is a different company: a vertical, its own content, and
full-time attention. Worth revisiting only if the free product finds users.

### Expected outcome, stated plainly

Realistically a few thousand rupees a month, a year in, if things go well. That
is not a business and should not be described as one. Its value is as evidence
that the thing shipped, found users, and was worth something to them — which is
a different and more useful claim than revenue on its own.

## The 60-second test

A hiring engineer opens the repo. In 60 seconds they must find:

1. A one-click **demo** with populated data — no signup wall
2. A live **Swagger** URL
3. A **schema diagram** in the README
4. A green **CI badge** (lint + typecheck + test + build)
5. `docker compose up` in the README that actually works
6. A complete `.env.example`

If any of these is missing the rest of the work is discounted.
