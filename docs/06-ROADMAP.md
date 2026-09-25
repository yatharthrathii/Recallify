# 06 — Build Order

Sequenced so that **every phase ends with something shippable**. If the plan
stops at any phase boundary, what exists is still coherent and still honest.

Estimates assume part-time work alongside a full-time job.

---

## Phase 0 — Stop the bleeding (1 day) · done, one item open

Do this before writing any v2 code.

- [x] **Revoke the OpenRouter key.** It was readable in the deployed bundle at
      `recallify-fawn.vercel.app/assets/index-*.js`. Revoked by Yatharth.
- [ ] ~~Remove `VITE_OPENROUTER_API_KEY` from the client.~~ Not done, on
      purpose: v1's code is frozen, and the key those two call sites read is
      revoked, so what remains is inert. Every v2 AI call is server-side.
- [ ] Fix the GitHub description and README on the existing repo:
  - [x] README rewritten — the false claims removed, a "What it does not do"
        section and a list of known issues added
  - [ ] **The GitHub repo description still claims spaced repetition and the
        OpenAI API.** It is a repository setting, not a file, so only Yatharth
        can change it. This is the one open item.
- [x] Add a short "v2 in progress" note — the top of v1's README.

Everything else in this roadmap is optional. **This phase is not.** The whole
rebuild exists because the description got ahead of the code; leaving it that way
one day longer than necessary undermines the point.

---

## Phase 1 — Foundation (3 days)

- pnpm workspaces + Turborepo, shared tsconfig / eslint / prettier
- `apps/api` NestJS 11 skeleton, `apps/web` Next.js 16 skeleton
- `packages/{fsrs,contracts,tokens,core,config}` stubs
- Prisma schema from `03-DATA-AND-API.md`, first migration
- `infra/docker-compose.yml` — Postgres + API + web, one command
- `.env.example`, complete
- CI: lint, typecheck, build. Green badge before any feature exists.

**Ships:** a repo that builds, tests, and boots with `docker compose up`.

---

## Phase 2 — The algorithm (5 days) · the core

- `packages/fsrs`: DSR model, 21 parameters, state machine
  (NEW → LEARNING → REVIEW → RELEARNING), pure and zero-dependency
- Unit tests for every transition and edge case (same-day review, first review,
  lapse from long interval, suspended cards)
- Property-based tests with `fast-check` — the invariant list in `05`
- Differential tests against `ts-fsrs` across 19,000 generated cases
- 100% coverage, enforced in CI

**Ships:** a proven scheduler. This is the part of the project that is not CRUD,
and it is worth more than everything after it.

---

## Phase 3 — The optimizer (5 days) · the differentiator

- Log-loss over a review history: predicted retrievability vs actual outcome
- Parameter training (gradient descent; coordinate descent is an acceptable
  simpler first pass) with numerical-stability guards
- Backtest: replay a history under default vs trained parameters, report
  retention and reviews/day for each
- Tests: loss strictly decreases; converges on synthetic data with known
  parameters; degrades gracefully on tiny histories (< 100 reviews → refuse and
  say why, do not return noise)

**Ships:** a measured before-and-after, not a slogan. On simulated learners with
known parameters, training closes over half the gap to the truth and roughly
halves calibration error (0.031 → 0.017).

The workload number moves in **both** directions, which is the honest part:

| Learner | Interval | Daily reviews |
|---|---|---|
| Forgets faster than average | 60.3d → 40.7d | +48% |
| Forgets slower than average | 60.3d → 82.1d | −27% |

The optimizer does not promise less studying. It promises an accurate model —
and for someone who forgets quickly, accuracy means more reviews, not fewer.
Any marketing that claims otherwise is claiming something the code does not do.

---

## Phase 4 — API (5 days)

- Auth: register, login, refresh with rotation + reuse detection, logout
- Decks, cards CRUD with ownership guards
- `POST /review` (idempotent) and **`POST /review/batch` — build it now**, even
  though only mobile will use it. Retrofitting it in Phase 8 means touching auth,
  scheduling, and stats again.
- `/review/queue`, `/review/explain/:cardId`
- `/optimizer/run`, `/optimizer/backtest`
- Server-side stats: xp, level, streak, heatmap (fixes the v1 XP bugs)
- `nestjs-zod` → Swagger at `/docs`
- Integration tests against a real Postgres in CI

**Ships:** a documented, tested API. Swagger URL is now a deliverable.

Done. `/optimizer/backtest` was folded into `/optimizer/run` -- both need the
same replay of the same log, so as separate endpoints the expensive half of the
work would be done twice. `/optimizer/status` and `/optimizer/reset` were added:
the UI has to know whether there is enough history to fit on before it offers
the button, and adopting fitted parameters is worth nothing if it cannot be
undone.

---

## Phase 5 — AI (2 days) · done

- `POST /ai/generate` — Groq, `gpt-oss-120b` with `gpt-oss-20b` as fallback
- Zod-validated structured output; one retry on parse failure; reject otherwise
- Rate limits and the per-user daily cap from `03`
- `AiUsage` logging for the cost chart
- `POST /ai/report` — the in-app path Google Play requires for flagging AI output

### What measurement changed

The plan above originally said "Llama 3.3 70B, Gemini fallback". Both were wrong
by the time the code was written, and neither was caught by reading about it.

- **Llama 3.3 70B no longer exists on Groq.** Neither does Llama 3.1 8B. Listing
  the account's models returned the gpt-oss pair, a Qwen model and some speech
  models. Gemini 2.0 Flash, the planned fallback, was retired in March 2026.
- **The real limits are lower than published summaries said.** Read off this
  account's response headers: 1,000 requests a day and 8,000 tokens a minute,
  per model. Notes were capped at 10,000 characters as a result.
- **Qwen was ruled out on one number**: an output limit of 1,000 tokens a
  minute. A single ten-card generation used 618 of them; the next request was
  refused.
- **120b over 20b, by reading the cards.** Both returned ten valid cards out of
  ten in every run. Reading all forty from one comparison: 20b got about three
  facts wrong (Article 15 for public employment, which is Article 16; calling
  oxaloacetate an electron carrier) and ignored "keep answers short"; 120b got
  about one wrong across all runs. Four topics is not a benchmark, and the
  choice is one environment variable.
- **The fallback is nearly free capacity.** Each model has its own rate-limit
  bucket, so trying the second on a 429 roughly doubles what the free tier
  serves.
- **Generation returns drafts, not cards.** The 120b model wrote "Article 12
  lists the Fundamental Rights" — Article 12 defines the State. A confident
  wrong card saved straight into a review schedule gets memorised, so the user
  reads the drafts and saves what is worth keeping.

**Build the quota as a stored allowance, not a hardcoded number.** Generation is
the only feature with a real marginal cost, so it is the only honest candidate
for a paid tier later. Reading the limit from the user's plan now makes that a
config change; hardcoding it now makes it a refactor across the AI module, the
UI and the tests.

That is the whole preparation. No billing, no plans table, no pricing — those
are decisions for after the thing has users.

**Ships:** honest AI generation, server-side, capped.

The quota test was the most instructive failure of the phase. The allowance is
reserved under a row lock before the model is called, and a test was written to
prove two simultaneous requests cannot both spend it. It passed. It also passed
with the lock deleted: over HTTP the requests never overlapped, and against a
cold connection pool the second reservation could not start until the first had
committed. Warming the pool made the race real — six requests, all six through,
120 cards charged against a limit of 20 — and the test now fails without the
lock every time. The lock itself then had to change: queued requests each held
a pooled connection while they waited, and four of six ran past the
transaction timeout and came back as 500s. It is `FOR UPDATE NOWAIT` now, and a
second simultaneous generation for the same account is refused at once.

---

## Phase 6 — Web (6 days) · done

- [x] Design tokens → Tailwind `@theme`; `PageShell`; Button/Field/Dialog
- [x] Auth pages, deck list, card editor
- [x] **Review session** — keyboard-only, local FSRS. The next card is on
      screen before the request leaves; answers go through an outbox in
      localStorage and are resent until the server has them
- [x] **Forgetting curve** — the signature component, built by hand
- [x] **"Why this card?"** panel — computed in the browser by the engine, no
      request
- [x] **Retention target slider** with live workload cost
- [x] Heatmap, forecast, optimizer before/after
- [x] Skeletons, empty states, error states for every route
- [x] Command palette
- [x] PWA manifest
- [x] **Offline review shell.** `public/sw.js`: build files cache first, app
      pages and API reads network first with the last answer kept, and an
      offline page for anything never opened. The review screen reopens with no
      connection and answers wait in the outbox. Signing in or out clears the
      cached pages and data. Covered by an E2E test.
- [x] **View Transitions: decided against, phase 7.** React's
      `<ViewTransition>` is only in canary builds (19.2.8 has `Activity`, not
      `ViewTransition`), and Next's flag depends on it. Page and card changes
      use `motion`, which gives the same cross-fade and honours reduced motion
      through one `MotionConfig`. Revisit when it reaches a stable React.

Verified by driving the real stack in a browser: 20 steps from "signed-out
visit is redirected" through a full keyboard review session to "deleted account
cannot sign in", with results checked against the API rather than the screen.
Every page was also screenshotted at 1440 and 390 wide in both themes, with a
horizontal-overflow measurement on each.

**Ships:** the product, usable.

---

## Phase 7 — Make it findable (4 days) · done in code, two steps are Yatharth's

- [x] **Seed script and demo account.** `apps/api/src/demo`: the scheduler
      simulates a learner over six months, with lateness, a missed week, and
      answers drawn from the model's own predicted recall. `pnpm db:seed` makes a
      local account; `POST /auth/demo` makes a private one per visitor, swept
      after a day. Every demo has at least 450 reviews, so the optimizer works in it.
- [x] **Deploy.** API on Vercel with Neon, web on Vercel, separate databases for
      local and production.
- [x] **Uptime.** `.github/workflows/uptime.yml`: `/health` every 30 minutes,
      `/ready` once a day.
- [x] **Playwright E2E in CI, Lighthouse CI, size-limit.** See 05-ENGINEERING.
- [x] **README** with the GIF, both diagrams, the live links and badges.
      Web: recallify-five.vercel.app. API: recallify-api.vercel.app.
- [x] Found on the way: a **sign-in rate limit** and **password reset**, the two
      API gaps listed after phase 4. The faint text colour failed contrast at
      3.1:1 and was darkened to 4.8:1.
- [ ] Yatharth: `WEB_URL`, `BREVO_API_KEY` and `MAIL_FROM` in the API's Vercel
      settings, once the Recallify mailbox exists. Until then a production
      reset request answers 503 rather than pretending to send.

**Ships: 🚀 web is live and verifiable.** The project is resume-ready here.
Everything after this is upside.

---

## Phase 8 — Anki import and the Memory Report (1.5 weeks)

The acquisition door, and the first thing anyone might pay for. Deliberately
placed before mobile: it needs no app, and it is what brings users in.

### Anki import

`.apkg` is a zip containing a SQLite database. Parsing it gives two things at
once: a way for an Anki user to move in without retyping anything, and the
review history the report below is built from.

- `POST /import/anki` — upload, parse, map notes and cards, preserve the
  review log
- Map Anki's scheduling state onto ours where it exists; fall back to NEW
  where it does not, and say so rather than inventing stability
- CSV import shares the same pipeline

This is the single biggest reason an Anki user would try Recallify. Without it
they would have to abandon years of history, and they will not.

### The Memory Report

Anki ships an FSRS optimizer. It returns 21 numbers and explains none of them.
`packages/optimizer` already produces the comparison Anki does not show —
this turns that into something a person can read.

```
POST /report        an Anki export, or the user's own history
GET  /report/:id    the result
```

Contents:

- The user's own forgetting curve against the population default
- Fitted parameters, described in words: "you forget about a third faster
  than average"
- Backtest: predicted retention, calibration error, and the workload the
  change implies — **in whichever direction it actually goes**
- Review-time-of-day and day-of-week patterns, from the log
- Leeches: cards failing repeatedly, ranked by time wasted
- Per-deck cost: which deck is buying the least retention per review

### Exam-day prediction

Every student preparing for a fixed date is asking one question: what will I
still know on the day? The fitted model can answer it directly — project each
card's retrievability forward to the exam date and sum.

```
GET /stats/exam?date=2027-05-05&deckId=
    expected cards recalled on that date, with a range
    the cards most likely to be forgotten, ranked
    the reviews between now and then that would move the number most
```

It is honest only if it is calibrated: the backtest already measures whether
predicted recall matches what the user actually recalled, and the prediction
should be shown with that calibration error beside it rather than as a single
confident number. Below `MIN_REVIEWS` it is shown with the published defaults
and labelled as such.

This is new presentation over existing mathematics, which is why it lives here
and not in its own phase.

The engine for all of this exists. Phase 8 is presentation and the importer,
not new algorithms.

**Ships:** a reason for an existing Anki user to show up, and the first
candidate for a paid tier.

---

## Phase 8b — Live decks (2 weeks)

A deck other people subscribe to, which its author keeps improving — without
anyone's review history being reset when a card is corrected.

This is what AnkiHub charges $5–10 a month for, to more than 100,000 medical
students, on top of free Anki. It exists as a business because in Anki it is
hard: updating a shared deck and keeping each subscriber's scheduling is
painful. Here it is mostly already true. Card content and memory state are
separate — `Review` is an append-only log and a card's FSRS state is a cache of
it — so editing a card's text has never touched its schedule.

What is new:

- A published deck and a subscription to it
- Card identity that survives an author's edit: a subscriber's copy points at
  the source card, and a text change propagates while stability, difficulty
  and the log stay with the subscriber
- Additions and deletions from the author arrive as new cards and as
  suspensions — never as deletions of a subscriber's history
- A changelog per deck, so a subscriber can see what changed and why

Content is the harder half. A live deck is only worth subscribing to if
someone keeps it good, and that is writing and maintenance, not engineering.

**Ships:** the feature a paid tier would actually be built around.

---

## Phase 9 — Mobile (2.5 weeks)

Full feature parity except CSV/`.apkg` import (file picking is a laptop task).

- Expo SDK 54 + Expo Router; tokens → StyleSheet
- Reuse `packages/{fsrs,contracts,api-client,core}` unchanged
- `expo-sqlite` + Drizzle local store; outbox; NetInfo-triggered batch sync
- Auth via `expo-secure-store`
- Screens: decks, card editor, AI generate, review, stats, settings
- **Offline review** — the feature the web app cannot have

If the Play Console account was created after 13 Nov 2023, closed testing needs
12 testers for 14 continuous days. **Start recruiting testers during Phase 7**,
not after Phase 9, or that requirement adds two idle weeks.

**Ships:** Android app on the Play Store.

iOS is deferred. Publishing needs the Apple Developer Program at $99 a year,
charged whether or not the app earns anything, and the app is removed from the
store when a renewal lapses. That is a cost to take on once there is revenue to
set against it, not before.

---

## Phase 10 — Charging for it (only once there are users)

Nothing here is built until people are using the free version. Billing built
for users who do not exist is a feature nobody tests.

- The paid tier is the live-deck subscription and a larger AI allowance. The
  allowance is already a stored number per user, so raising it is an UPDATE.
- The forgetting curve, "why this card?", the retention slider and the
  optimizer stay free — see non-negotiable 11 in `CLAUDE.md`.
- On Android, digital goods go through Google Play Billing. Its current terms
  are to be checked when this phase starts, not assumed now.

**Not ads.** Evaluated and rejected, with the numbers in `01-PRODUCT.md`: at
Indian eCPM rates an app needs about a thousand daily users to earn roughly
₹85 a day — and a thousand users generating once a day is exactly the AI free
tier's daily ceiling. Interstitials in a review session would also break the
one thing the product is for.

---

## Timeline

| Phase | Duration | Cumulative |
|---|---|---|
| 0 Stop the bleeding | 1 day | day 1 |
| 1 Foundation | 3 days | week 1 |
| 2 FSRS | 5 days | week 2 |
| 3 Optimizer | 5 days | week 3 |
| 4 API | 5 days | week 4 |
| 5 AI | 2 days | week 5 |
| 6 Web | 6 days | week 6 |
| 7 Live | 4 days | **week 7 — shippable** |
| 8 Anki import + Memory Report + exam-day | 1.5 weeks | week 9 |
| 8b Live decks | 2 weeks | week 11 |
| 9 Mobile | 2.5 weeks | week 14 |
| — Play Store review | ~1 week | week 15 |
| 10 Charging | only once there are users | — |

~3.5 months part-time. **Week 7 is the milestone that matters.**

---

## Interview framing

Say these. They are all true, which is the point.

> **On the rebuild**
> "I built v1 last year. Later I noticed the README claimed spaced repetition and
> AI when the code had neither — a card was literally `{question, answer}`. I
> corrected the description first, then rebuilt it properly in TypeScript,
> starting with the algorithm and its tests."

> **On FSRS**
> "FSRS is a published algorithm — DSR model, papers at KDD and TKDE, and it's
> what Anki uses by default. `ts-fsrs` already exists in TypeScript with about
> 133k weekly downloads. I implemented it from the algorithm myself because that
> was the point of the project, and I differential-tested my implementation
> against `ts-fsrs` across 19,000 generated cases to prove it's correct."

> **On the isomorphic package**
> "The scheduler is pure and dependency-free, so the same code runs on the server
> as source of truth, in the browser for instant optimistic rating, and on the
> phone for fully offline scheduling. Server and client can't disagree."

> **On sync**
> "Reviews are an append-only log with client-generated UUIDs, so sync is
> idempotent replay rather than conflict resolution. That's also why the review
> endpoint takes an idempotency key."

> **On the monolith**
> "One developer. Module boundaries give the same discipline as microservices
> with none of the operational cost."

### Never say

- "I invented a new algorithm" — false
- "Nobody has built this" — false, and easy to check
- "AI-powered smart learning" — the v1 mistake, in new clothes

---

## Scope discipline

If time runs short, cut in this order:

1. Command palette
2. CSV import
3. Heatmap
4. AI generation *(gets a "planned" note in the README, not a claim)*

**Never cut:** Phase 2, Phase 3, the demo account, or the forgetting curve. Those
four are the project. Everything else is packaging.
