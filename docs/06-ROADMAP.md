# 06 — Build Order

Sequenced so that **every phase ends with something shippable**. If the plan
stops at any phase boundary, what exists is still coherent and still honest.

Estimates assume part-time work alongside a full-time job.

---

## Phase 0 — Stop the bleeding (1 day) · NOT STARTED

Do this before writing any v2 code.

- [ ] **Revoke the OpenRouter key.** It is currently readable in the deployed
      bundle at `recallify-fawn.vercel.app/assets/index-*.js`. Anyone can extract
      and spend it. This is live right now.
- [ ] Remove `VITE_OPENROUTER_API_KEY` from the client. Any AI call belongs
      server-side, always.
- [ ] Fix the GitHub description and README on the existing repo:
  - remove the **"spaced repetition"** claim — there is no such code
  - "Storage: localStorage" → it is Firebase Realtime DB over REST
  - "State: useState, useEffect" → it is Context API
  - describe the AI honestly: OpenRouter + DeepSeek, client-side (and note it is
    being moved server-side in v2)
- [ ] Add a short "v2 in progress" note pointing at this `docs/` folder.

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

---

## Phase 5 — AI (2 days)

- `POST /ai/generate` — Groq (Llama 3.3 70B), Gemini fallback
- Zod-validated structured output; one retry on parse failure; reject otherwise
- Rate limits and the per-user daily cap from `03`
- `AiUsage` logging for the cost chart

**Ships:** honest AI generation, server-side, capped.

---

## Phase 6 — Web (6 days)

- Design tokens → Tailwind `@theme`; `PageShell`; Button/Card/Field/Dialog
- Auth pages, deck list, card editor
- **Review session** — keyboard-only, local FSRS, <50ms advance, View Transitions
- **Forgetting curve** — the signature component, built by hand
- **"Why this card?"** panel
- **Retention target slider** with live workload cost
- Heatmap, forecast, optimizer before/after
- Skeletons, empty states, error states for every route
- Command palette
- PWA manifest + offline review shell

**Ships:** the product, usable.

---

## Phase 7 — Make it findable (4 days)

- **Seed script + demo account** — use `packages/fsrs` itself to simulate a
  realistic learner over 6 months. Never random data; the curve must look real.
- Deploy: Neon + Vercel (web and API), uptime ping to `/health`
- Playwright E2E in CI; Lighthouse CI; size-limit
- README: what it is, `docker compose up`, schema diagram, Swagger link, demo
  link, 30-second GIF, badges. No emoji headings. No inflated claims.

**Ships: 🚀 web is live and verifiable.** The project is resume-ready here.
Everything after this is upside.

---

## Phase 8 — Mobile (2.5 weeks)

Full feature parity except CSV/`.apkg` import (file picking is a laptop task).

- Expo SDK 54 + Expo Router; tokens → StyleSheet
- Reuse `packages/{fsrs,contracts,api-client,core}` unchanged
- `expo-sqlite` + Drizzle local store; outbox; NetInfo-triggered batch sync
- Auth via `expo-secure-store`
- Screens: decks, card editor, AI generate, review, stats, settings
- **Offline review** — the feature the web app cannot have

If the Play Console account was created after 13 Nov 2023, closed testing needs
12 testers for 14 continuous days. **Start recruiting testers during Phase 7**,
not after Phase 8, or that requirement adds two idle weeks.

**Ships:** Android app on the Play Store.

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
| 8 Mobile | 2.5 weeks | week 10 |
| — Play Store review | ~1 week | week 11 |

~2.5-3 months part-time. **Week 7 is the milestone that matters.**

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
