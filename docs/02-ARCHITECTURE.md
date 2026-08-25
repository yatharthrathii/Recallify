# 02 — System Architecture

## Shape

A **modular monolith** API with two thin clients. Not microservices — there is
one developer, and a monolith with clean module boundaries is the correct call.
Say that out loud in interviews; picking the boring right thing is signal.

```
                    ┌──────────────────────────────┐
                    │      packages/fsrs           │
                    │  pure TS · zero deps         │
                    │  runs on BOTH sides          │
                    └───────┬──────────────┬───────┘
                            │              │
   ┌────────────────┐       │              │       ┌────────────────┐
   │   apps/web     │───────┘              └───────│  apps/mobile   │
   │   Next.js 16   │                              │   Expo / RN    │
   │                │                              │  SQLite local  │
   └───────┬────────┘                              └───────┬────────┘
           │  same-origin /api/* (BFF proxy)               │ HTTPS + Bearer
           │  httpOnly cookie                              │ SecureStore
           └───────────────────┬───────────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │      apps/api        │
                    │      NestJS 11       │
                    │ auth · decks · cards │
                    │ reviews · scheduler  │
                    │ ai · stats · optim.  │
                    └──────────┬───────────┘
                               │ Prisma
                               ▼
                    ┌──────────────────────┐
                    │  PostgreSQL (Neon)   │
                    └──────────────────────┘
```

### The one idea that makes this design work

`packages/fsrs` is **isomorphic** — pure TypeScript, zero dependencies, no I/O.
The identical code runs:

- on the **server**, as source of truth when a review is persisted
- in the **browser**, to compute the next card state instantly on keypress
- on the **phone**, to schedule correctly while fully offline

That is why rating a card feels instant (<50ms, no network round trip), why
offline review is possible at all, and why server and client can never disagree
about scheduling.

One pure module, three runtimes. This is the architectural payoff — lead with it.

## Monorepo

pnpm workspaces + Turborepo (local cache only; remote caching off).

```
recallify/
├── apps/
│   ├── api/                 NestJS 11 — REST + OpenAPI
│   ├── web/                 Next.js 16 App Router
│   └── mobile/              Expo (phase 4 — after web is live)
├── packages/
│   ├── fsrs/                algorithm — pure, zero-dep, 100% covered
│   ├── contracts/           Zod schemas = single source of truth
│   ├── api-client/          typed client built from contracts
│   ├── core/                shared hooks: review session state machine
│   ├── tokens/              design tokens as plain TS (web + RN both read)
│   └── config/              eslint / tsconfig / prettier presets
├── infra/
│   ├── docker-compose.yml
│   └── Dockerfile.api
├── docs/                    this folder
└── .github/workflows/
```

### What web and mobile CAN and CANNOT share

This determines the real cost of feature parity.

| Layer | Shared? | Why |
|---|---|---|
| FSRS algorithm | yes, 100% | pure TS |
| Zod contracts / types | yes, 100% | pure TS |
| API client | yes, 100% | both run `fetch` |
| TanStack Query hooks | yes, ~95% | TanStack Query runs in React Native |
| Review session logic | yes, 100% | state machine in `packages/core` |
| Design tokens | yes, 100% | plain objects; web to CSS vars, RN to StyleSheet |
| **UI components** | **no, 0%** | `div` vs `View`. Nothing shareable |
| Navigation | no, 0% | App Router vs Expo Router |

**Result: mobile costs ~50-60% of what web cost, not 100%.** Everything above the
render layer is already written. Build web with this split enforced from day one
— logic in `packages/core`, pixels in the app. If that discipline slips, mobile
doubles in cost.

## Stack — and why

Versions verified August 2026.

| Layer | Choice | Version | Why this, honestly |
|---|---|---|---|
| Runtime | Node | 22 LTS | |
| Package mgr | pnpm | 9 | workspaces, strict, fast |
| Monorepo | Turborepo | 2 | task graph + cache |
| **API** | NestJS | 11.2 | DI + modules force boundaries. SWC builder, ~20x faster builds |
| ORM | Prisma | 6.19 | migrations are real files; typed client. Not v7 — too new |
| DB | PostgreSQL 16 | Neon | free forever, 0.5 GB, no card |
| Validation | Zod | 3 | one schema to validation + TS types + OpenAPI |
| Zod to Nest | `nestjs-zod` | — | Swagger generated from the same Zod schema |
| API tests | Vitest + Supertest | — | Nest 11 ships Vitest |
| **Web** | Next.js | 16.3 | App Router, RSC, View Transitions + React Compiler stable |
| React | React | 19.2 | Compiler auto-memoizes — no manual `useMemo` noise |
| Data | TanStack Query | 5 | works in RN too — that is the deciding factor |
| Styling | Tailwind | 4 | CSS-first config via `@theme` |
| Primitives | Radix UI | — | headless + accessible. **Not** default shadcn styling — see 04 |
| Motion | `motion/react` | 12 | the framer-motion successor. Pick ONE — v1 has both installed |
| Charts | hand-built SVG + `d3-shape` | — | the forgetting curve is our signature; a chart lib makes it generic |
| **Mobile** | Expo | SDK 54 | |
| Local DB | expo-sqlite + Drizzle | — | live queries, type-safe. Simpler than WatermelonDB; we don't need its sync protocol |
| AI | Groq (Llama 3.3 70B) | — | free, no card, 30 rpm / 1000 rpd. Gemini fallback |
| Hosting | Vercel (web + API) | — | free forever, no cold-start disaster |
| CI | GitHub Actions | — | free unlimited on public repos |
| Errors | Sentry | — | free tier |

### Rejected, and why — keep these answers ready

- **GraphQL** — REST + OpenAPI gives a public Swagger URL, which is a stated
  deliverable. GraphQL would add complexity for one class of consumer.
- **Microservices** — one developer. Module boundaries give the same discipline
  with none of the operational cost.
- **Prisma 7** — released too recently. 6.19 is stable and boring. Boring wins.
- **Redis / BullMQ** — Upstash is not BullMQ-compatible (HTTP transport, no Lua
  or persistent TCP). If a queue is ever needed, `pg-boss` on the Postgres we
  already have. No new service, no new bill.
- **Render / Railway / Fly / Koyeb** — Render's free Postgres *expires after 30
  days* and free web services cold-start 30-60s. Railway and Fly removed free
  tiers. Koyeb closed new signups after the Mistral acquisition. Verified Aug 2026.
- **`ts-fsrs` as a dependency** — we implement FSRS ourselves; that is the point
  of the project. But we **differential-test against it** (see 05). It is the
  examiner, not the competitor.

## Request flow — web

Next.js acts as a **BFF proxy**. The browser never talks to NestJS directly.

```
browser ──fetch('/api/decks')──► Next route handler ──► NestJS ──► Postgres
         httpOnly cookie             reads cookie,
         (JS cannot read it)         attaches Bearer
```

Why: the refresh token lives in an `httpOnly`, `SameSite=Lax`, `Secure` cookie
that JavaScript cannot read, so an XSS cannot steal it. Same-origin means no
CORS preflight. The access token never touches `localStorage`. This is the
correct production pattern and it is one sentence to defend in an interview.

Mobile skips the proxy — it holds tokens in `expo-secure-store` and calls the API
directly with a `Bearer` header.

## Rendering strategy — Next.js 16

| Route | Strategy | Reason |
|---|---|---|
| `/` landing | Static (SSG) | LCP under 1s, no data needed |
| `/demo` | Static shell + client hydrate | must open instantly for recruiters |
| `/decks` | RSC initial + Query hydrate | data on first paint, interactive after |
| `/review/[deckId]` | Client, queue prefetched | must be 100% local once started |
| `/stats` | RSC + streaming Suspense | charts stream in independently |
| `/api-docs` | redirect to Swagger | |

Use **Cache Components** (`use cache`) for the deck-list shell and **View
Transitions** for the review-card advance — both stable in Next 16.

## API modules

```
apps/api/src/
├── auth/        register, login, refresh (rotation + reuse detection), logout
├── users/       profile, settings (desired retention, daily limit)
├── decks/       CRUD, ownership guard
├── cards/       CRUD, bulk create, CSV import
├── reviews/     submit (idempotent), batch sync, history
├── scheduler/   wraps packages/fsrs — due queue, forecast, "why this card"
├── optimizer/   parameter training + backtest
├── ai/          generation, rate limit, per-user cost cap
├── stats/       xp, streak, level, heatmap  (server-side — fixes the v1 bug)
└── common/      guards, interceptors, filters, request-id, logger
```

**Rule: no module imports another module's repository.** Cross-module reads go
through the owning module's service. That boundary is what makes the "modular
monolith" claim honest instead of decorative.

## Environments

| | Local | Production |
|---|---|---|
| DB | Docker Postgres | Neon |
| API | `localhost:3001` | Vercel |
| Web | `localhost:3000` | Vercel |
| AI | Groq (same key, low cap) | Groq |

**Local and prod must never share a database.** That was the v1 bug: cards
created on `localhost` showed up on the live site because one Firebase project
served both. Separate `.env` files, separate databases, always.

## Known free-tier operational notes

- Neon scales to zero after ~5 min idle. Combined with Vercel cold start the
  first request can be 2-3s. Mitigation: ping `/health` every 10 min from
  cron-job.org or UptimeRobot (both free). Bonus: UptimeRobot gives a public
  status badge for the README.
- Groq free tier is 30 req/min and 1000 req/day **account-wide**. The per-user AI
  cap in the `ai` module is not decoration — without it one user drains the day's
  quota for everyone, including the recruiter looking at the demo.

## Build gotchas found while scaffolding

Recorded so phase 4 and 6 do not rediscover them.

- `@nestjs/swagger` must be **v11**. v8 declares peers of Nest 9/10 only and
  installs with an unmet-peer warning against Nest 11.
- The Nest SWC builder needs `@swc/cli` and `@swc/core` as explicit dev
  dependencies; `nest build` fails without them.
- SWC emits to `dist/src/` unless `nest-cli.json` sets
  `builder.options.stripLeadingPaths: true`. Without it `node dist/main.js` and
  the Dockerfile `CMD` both point at nothing.
- `reactCompiler` is **top-level** in Next 16, not under `experimental`, and it
  requires `babel-plugin-react-compiler` to be installed even though Next has
  built-in support.
