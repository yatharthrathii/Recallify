# Recallify

[![CI](https://github.com/yatharthrathii/Recallify/actions/workflows/ci.yml/badge.svg?branch=v2)](https://github.com/yatharthrathii/Recallify/actions/workflows/ci.yml)

A spaced-repetition scheduler built on FSRS, with the algorithm made visible.

Every serious flashcard app hides its scheduler. Anki has run FSRS by default
since 2023 and shows the user almost nothing about it. Recallify's bet is that
the scheduler is the interesting part, so it surfaces the memory model instead of
hiding it: the forgetting curve per card, why a given card is due right now, and
what your own review history says about the default parameters.

> **Status: phase 3 of 9 complete.** The scheduler works end to end, and
> parameters can now be fitted to a user's own review history and backtested
> against the defaults. There is no API, no database and no UI yet. This
> README will not claim a feature before the code does it — the
> [v1 rewrite](#why-v2-exists) happened because an earlier README did exactly
> that.

## Build status

| Phase | | |
|---|---|---|
| 0 | Corrections to v1 | done |
| 1 | Monorepo, Prisma schema, Docker, CI | done |
| 2 | FSRS engine: memory model + scheduler | done |
| 3 | Parameter optimizer + backtest | done |
| 4 | API | pending |
| 5 | AI card generation | pending |
| 6 | Web client | pending |
| 7 | Deploy, seed data, public demo | pending |
| 8 | Anki import + Memory Report | pending |
| 9 | Android app | pending |

Full plan: [`docs/06-ROADMAP.md`](docs/06-ROADMAP.md).

## Running it

Requires Node 22, pnpm 9, and Docker.

```bash
pnpm install
cp .env.example .env          # then fill in the two JWT secrets
pnpm up                       # postgres + api via docker compose
pnpm db:migrate               # apply the schema
pnpm dev                      # api on :3001, web on :3000
```

Generate the JWT secrets with `openssl rand -base64 48`, once each.

| | |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| API docs | http://localhost:3001/docs |
| Health | http://localhost:3001/health |

## Layout

```
apps/
  api/          NestJS 11 — REST + OpenAPI, Prisma, PostgreSQL
  web/          Next.js 16 — App Router, React 19, Tailwind 4
packages/
  fsrs/         the scheduling algorithm — pure, zero-dependency
  optimizer/    fits parameters to a review log; server-only
  contracts/    Zod schemas: validation + types + OpenAPI, defined once
  core/         logic shared with the future mobile client
  tokens/       design tokens — the only place a colour value may exist
  config/       shared tsconfig presets
infra/          docker-compose, API Dockerfile
docs/           architecture, data model, design system, roadmap
```

`packages/fsrs` has no dependencies and performs no I/O, so the same code runs on
the server as the source of truth, in the browser for instant optimistic rating,
and later on the phone for fully offline scheduling. Server and client cannot
disagree about scheduling because they run the same function.

## On FSRS

FSRS is a published algorithm built on the DSR (difficulty / stability /
retrievability) memory model, with papers at ACM KDD and IEEE TKDE, and it is
what Anki uses by default. It is **not** original to this project.

[`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) is the established
TypeScript implementation. This repository implements the algorithm from scratch
because doing so is the point of the project, and it uses `ts-fsrs` as a **test
oracle**: differential tests assert that both implementations agree across
19,000 generated cases. It is a dev dependency, never shipped.

## Documentation

| | |
|---|---|
| [`docs/01-PRODUCT.md`](docs/01-PRODUCT.md) | Thesis, competitors, feature tiers |
| [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) | System shape, stack, request flow |
| [`docs/03-DATA-AND-API.md`](docs/03-DATA-AND-API.md) | Schema, endpoints, auth |
| [`docs/04-DESIGN-SYSTEM.md`](docs/04-DESIGN-SYSTEM.md) | Colour, type, motion |
| [`docs/05-ENGINEERING.md`](docs/05-ENGINEERING.md) | Budgets, sync, testing, security |
| [`docs/06-ROADMAP.md`](docs/06-ROADMAP.md) | Build order |

## Why v2 exists

v1 was a React and Firebase app. Its README claimed spaced repetition and
"AI-Powered" learning; the code implemented neither, and a card was literally
`{ question, answer }`. The AI key was a `VITE_` variable, which meant it was
inlined into the production bundle and publicly readable.

The description was corrected first, then the rebuild started. v1 remains in
[`../recallify`](../recallify) with its corrections and its own list of known
bugs, unedited otherwise.

## License

MIT
