# Recallify v2 — working agreement

Read this first, every session. Full detail lives in `docs/`.

| Doc | Covers |
|---|---|
| [docs/01-PRODUCT.md](docs/01-PRODUCT.md) | Thesis, competitor analysis, feature tiers, the 60-second test |
| [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | System shape, monorepo, stack + why, request flow, modules |
| [docs/03-DATA-AND-API.md](docs/03-DATA-AND-API.md) | Prisma schema, endpoints, auth flow, AI contract |
| [docs/04-DESIGN-SYSTEM.md](docs/04-DESIGN-SYSTEM.md) | Color, type, motion, anti-AI-look rules, the curve |
| [docs/05-ENGINEERING.md](docs/05-ENGINEERING.md) | Perf budget, loading, offline sync, testing, CI, security |
| [docs/06-ROADMAP.md](docs/06-ROADMAP.md) | Phased build order, timeline, interview framing |

## What this is

A spaced-repetition scheduling engine (FSRS) with a web client, and later an
Android client. **The engine is the product**; the app demonstrates it.

It is a portfolio artifact built to be verifiable. v1 shipped a README claiming
spaced repetition and AI that the code did not implement. v2 exists to fix that.
That history is why the honesty rules below are not negotiable.

## Current state

- `../recallify/` — v1. React 19 + Vite + Firebase RTDB. **Not** being upgraded.
  Its README has been corrected; the code is otherwise untouched.
- Phase 0 done, except one item only Yatharth can do: **the v1 OpenRouter key is
  still live** and readable in the deployed bundle. It must be revoked at
  openrouter.ai/keys.
- Phase 1 done. Workspace builds; lint, typecheck, tests and CI are green.
- Phase 2 done. `packages/fsrs` is complete: the DSR memory model (verified
  against ts-fsrs) plus the scheduler state machine — `schedule`, `explain`,
  `replay`, learning steps, graduation, lapsing, interval fuzz.
  97 tests, 100% coverage including branches.
- **Next: phase 3** — the parameter optimizer and backtest.

### Notes carried out of phase 2a

- `initialDifficulty` is deliberately **unclamped**: D0(4) is about -4.77 with
  the default weights and is the mean-reversion target in `nextDifficulty`.
  Clamping it there shifts every later difficulty update. The scheduler clamps
  when writing difficulty to a card; the model does not.
- `nextForgetStability` has **no** cap against the previous stability. The
  intuition that forgetting cannot strengthen a memory is wrong at the margin,
  and the oracle proved it.
- The floor of 1 on the short-term stability multiplier applies from **Hard**
  upwards, not from Good.
- Stability is computed from the **pre-update** difficulty. Feeding the freshly
  updated difficulty in shifts every result; confirmed against `next_state`.
- A RELEARNING card must use `relearningSteps`, not `learningSteps`. Keying that
  off "did this review lapse" alone leaves the card unable to ever graduate,
  because the flag is only true on the review that broke it.
- `SchedulingCard.learningStep` exists because a LEARNING card is otherwise
  ambiguous; `Card.learningStep` mirrors it in the schema.

## Non-negotiables

1. **Never inflate a claim.** Not in the README, not in a comment, not in a commit
   message, not in a UI string. If the code does not do it, do not write it down.
   This rule is the reason the project exists.
2. **TypeScript strict.** No `any` without a comment saying why.
3. **Zod is the single source of truth** for every contract — validation, types,
   and OpenAPI all come from `packages/contracts`.
4. **`packages/fsrs` stays pure** — zero dependencies, no I/O, no framework
   imports. It must run unchanged on server, browser, and phone.
5. **`Review` is append-only.** Never update, never delete. Card state is a cache
   derived from replaying it.
6. **Every query is scoped by `userId` in the `where`**, not filtered afterwards.
7. **No secret in a client bundle.** Nothing sensitive behind `NEXT_PUBLIC_`.
   v1 leaked its AI key exactly this way.
8. **Logic that mobile will need goes in `packages/core`**, not in a component.
   Slipping here is what makes the mobile app cost 2x instead of 0.5x.
9. **No raw hex outside `packages/tokens`.** Lint enforces it.
10. **Ask before large refactors or destructive changes.**

## Conventions

- Conventional commits
- Small reviewable steps, not one large drop
- Tests before implementation on `packages/fsrs` and `packages/optimizer`
- No emoji in headings, UI, or commit messages
- README is written for an engineer evaluating the author, not a tutorial reader
- Local and production **never** share a database (this was a real v1 bug)

## Working with Yatharth

- Full-stack engineer, ~1.5 years, currently NestJS + Next.js professionally.
  Not a beginner — skip beginner explanations.
- Explanations in Hinglish when he asks for them; **code, comments, docs, and
  commits always in English.**
- Be direct. If an idea is bad, say so and why. If he pushes back with a good
  argument, concede plainly and correct the record — that has already happened
  twice in this project's planning and both times he was right.
- Verify before asserting, especially anything about free tiers, library
  versions, or what already exists in the ecosystem. Advice given without
  checking has been wrong here before.

## Known v1 bugs — fixed by design in v2, do not reintroduce

| v1 | Where | v2 fix |
|---|---|---|
| AI key in client bundle | `FlashcardForm.jsx:38`, `Quiz.jsx:51` | all AI calls server-side |
| `newXP = newXP % 100` destroys total XP | `StatsContext.jsx:64` | cumulative `xp`, derived level |
| Daily XP overwritten, not accumulated | `StatsContext.jsx:72` | history derived from `Review` log |
| XP written from two places | `StatsContext` + `firebase.js:102` | one writer, `stats` module |
| Firebase idToken never refreshed — session dies at 1h | `AuthContext.jsx` | rotating refresh + reuse detection |
| `login({...user, username})` — wrong signature, silently broken | `Profile.jsx:30` | typed API client |
| Quiz runs on hardcoded `dummyData` | `FlashcardContext.jsx` | queue from the user's own cards |
| Local and prod share one Firebase project | `.env` | separate databases per environment |
| `npm run lint` fails, nobody notices | — | CI blocks on zero warnings |
