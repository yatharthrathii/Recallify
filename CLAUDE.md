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
- Phase 0 done, except one item only Yatharth can do: **the GitHub repo
  description still claims spaced repetition and the OpenAI API.** It is a
  repository setting, not a file. (The v1 OpenRouter key has been revoked.)
- Phase 1 done. Workspace builds; lint, typecheck, tests and CI are green.
- Phase 2 done. `packages/fsrs` is complete: the DSR memory model (verified
  against ts-fsrs) plus the scheduler state machine — `schedule`, `explain`,
  `replay`, learning steps, graduation, lapsing, interval fuzz.
  97 tests, 100% coverage including branches.
- Phase 3 done. `packages/optimizer` fits FSRS parameters to a user's own
  review log and backtests the result. 47 tests, 100% coverage.
- Phase 4 done. `apps/api` is a working NestJS service on Neon Postgres:
  auth with rotating refresh tokens and reuse detection, decks, cards, reviews
  (submit, offline batch, queue with daily caps, explain, history), server-side
  stats (xp, level, streak, heatmap, forecast, forgetting curve) and the
  optimizer endpoints. 30 of 33 operations publish a response schema at
  `/docs-json`; the other three are 204s with no body.
  34 integration tests run against a real Postgres both locally and in CI.
- Phase 5 done. `/ai/generate` drafts cards through Groq (`gpt-oss-120b`, with
  `gpt-oss-20b` as fallback), charges a stored per-user daily allowance, and
  saves nothing — the user saves drafts through `/cards/bulk`. `/ai/usage` and
  `/ai/report` (the in-app flagging Google Play requires). Verified end to end
  against the live Groq API. 32 of 36 operations publish a response schema;
  the other four are 204s.
- Phase 6 done, with two items left open (below). `apps/web` is the product:
  landing page with a live engine demo, auth, Today, decks, deck detail with
  the deck curve and card table, card editor with each card's own curve, AI
  draft review, the keyboard-first review session, stats with heatmap, forecast
  and the optimizer comparison, settings with the priced retention slider, a
  command palette, light and dark themes. `packages/core` holds everything
  above the render layer for mobile to reuse. The API gained settings update,
  account deletion, `/stats/workload` and the scheduling config on the queue.
  **275 tests**, plus a 20-step browser flow run against the real stack.
  Open: the offline review shell (service worker) and View Transitions.
- Next: phase 7, deploy.

Still missing from the API, found while auditing before phase 6: **password
reset** (needs an email provider) and a **rate limit on login**.

The roadmap gained three phases after a monetization review in September 2026:
exam-day prediction (inside 8), live decks (8b), and charging (10, only once
there are users). Ads were evaluated and rejected, and iOS is deferred until
there is revenue to set the $99/year against — both with numbers, in
`01-PRODUCT.md`.

Phases were re-ordered after a monetization review: Anki `.apkg` import and the
Memory Report became phase 8, ahead of mobile (now phase 9). Import is what
brings an existing Anki user in — without it they would have to abandon years of
history — and the Report is the optimizer's output made readable, which is the
one thing here nobody else sells. Neither needs the mobile app to exist.

### Notes carried out of phase 6

- **The web app never holds a token.** `app/api/auth/*` moves tokens into
  httpOnly cookies; `app/api/v1/[...path]` reads the access cookie and attaches
  the bearer. `document.cookie` is empty and nothing is in localStorage, and the
  browser flow asserts both.
- **The proxy does not refresh, the client does, once.** Refresh tokens rotate
  and a replayed one revokes the whole family, so parallel refreshes would sign
  a healthy session out. `Transport` in core single-flights within a tab, and
  `navigator.locks` extends that across tabs.
- **`packages/core` compiles to ES modules; every other package is CommonJS.**
  As CJS its `require('@tanstack/react-query')` loaded that library's CJS build
  while the app imported the ESM build: one package on disk, two instances, two
  React contexts, and every hook threw "No QueryClient set" under a provider
  that was plainly there. Same dual-package hazard as the ZodError one in phase
  4. Nothing in the API imports core, so ESM is safe there.
- **Unlayered CSS beats Tailwind utilities.** A hand-written `.pb-safe` class
  silently overrode `sm:pb-8` on the same element, and the review screen's last
  line was cut off. Custom one-offs are arbitrary utilities now
  (`pb-[env(safe-area-inset-bottom)]`), not classes in globals.css.
- **The curve needed two honest axis choices.** Plotted 0-100% on a linear time
  axis, a card held at 90% is a flat line at the top with its first reviews
  crushed into the left edge, because intervals grow geometrically. `yMin` fits
  the data and `xScale="sqrt"` compresses the far end; both are labelled on the
  chart. The API samples a card's curve per review segment for the same
  reason: evenly spaced samples skip a ten-minute learning step entirely.
- **Looking at the screen found what typecheck could not.** New cards read
  "12m overdue" (they are not late, they are not started), the Today page
  offered "Create a deck" while decks were still loading, and tiles showed
  "0 cards" before data arrived. All three were true to the types and false to
  the user.
- **The first theme was rejected and replaced.** Warm paper, Fraunces and an
  amber accent read as generated, and the animations (240ms, 8px) were too
  quiet to be seen at all. The theme is now two palettes Yatharth chose: blush,
  navy and raspberry in light; slate and deep teal in dark. Display type is
  Bricolage Grotesque. Motion is sized to be noticed; see `04-DESIGN-SYSTEM.md`.
- The accent (raspberry) is deliberately off the memory scale, so no control
  looks like a data point. Deck label colours are a separate chalky palette in
  tokens so "teal deck" never reads as "well remembered".
- Next 16 writes `AGENTS.md` and `CLAUDE.md` into the app on `next dev`.
  `agentRules: false` in next.config stops it; this repo has its own.
- UI copy contains no em or en dashes and none of the banned words in
  `04-DESIGN-SYSTEM.md`. Yatharth asked for this explicitly.
- GSAP was allowed but not added. `motion` covers every animation (word
  reveals, scroll reveals, count-ups, path draw, parallax, layout springs), and
  a second animation library would be weight with no job to do. Toasts are
  Sonner, restyled. Shared motion primitives are in `components/motion`.
- `.eyebrow` is unlayered CSS, so recolouring one needs Tailwind's important
  suffix (`text-on-brand/60!`). Same trap as `.pb-safe` above.

### Notes carried out of phase 5

- **Check what a provider actually serves before designing around it.** The
  plan named Llama 3.3 70B with a Gemini 2.0 Flash fallback. Listing the
  account's Groq models showed Llama was gone entirely, and Gemini 2.0 Flash
  had been retired months earlier. Published free-tier limits were wrong too;
  the real ones (1,000 requests/day, 8,000 tokens/minute, per model) came from
  the response headers.
- **Choose the model by reading its output.** Parse success was 100% for every
  candidate, so it could not separate them. Reading all the cards did: 20b made
  about three factual errors in twenty, 120b about one across every run.
- **Generation returns drafts.** A wrong card saved straight into a schedule is
  memorised. The 120b model wrote "Article 12 lists the Fundamental Rights".
- **A test that passes on the first run has not been shown to test anything.**
  The allowance race test passed with the row lock deleted in three different
  forms. Over HTTP the requests never overlapped; against a cold
  Prisma pool the second transaction could not start until the first had
  committed, because opening a Neon connection takes over a second. Warming the
  pool made the race real — all six through, 120 cards against a limit of 20 —
  and the test now fails without the lock, three runs out of three.
- **A waiting lock is a held connection.** The first lock was a plain
  `FOR UPDATE`. Under six simultaneous requests every waiter held a pooled
  connection, and four ran past Prisma's default 5-second interactive
  transaction timeout and came back as 500s (P2028). It is `FOR UPDATE NOWAIT`
  with an explicit transaction timeout, and a second simultaneous generation is
  refused with a 429.
- **Failures settle to zero, they are not deleted.** Deleting a failed
  reservation would refund it from the per-minute limit as well as the daily
  one, and a request that always fails could then hit the provider for free.
- **Rate limits live in the database.** The API is meant for serverless
  instances that share no memory; an in-process counter would give each one
  its own allowance.
- Integration tests never call Groq. `startHarness({ aiProvider })` replaces
  the provider, so CI needs no key and spends no quota. The provider's fallback
  chain is tested separately with `fetch` replaced.

### Notes carried out of phase 4

- **Vitest cannot run NestJS without SWC.** Vitest transforms with esbuild,
  which does not implement `emitDecoratorMetadata`. Without it Nest sees no
  constructor parameter types, every injected dependency arrives as
  `undefined`, and the first symptom is a 500 from a guard whose `Reflector` is
  missing. `apps/api/vitest.config.ts` uses `unplugin-swc` — the same compiler
  `nest build` already uses.
- **`instanceof` is not a safe way to recognise a library's error.** The
  contracts package is compiled to CommonJS while the API's own source loads as
  ESM under the test runner, so there were two `ZodError` classes and every
  validation failure came back as a bare 400 with no field errors. The problem
  filter now checks the shape. This is not a weaker test — it is the same test
  without the module-identity assumption.
- **`z.coerce.boolean()` is a trap.** It is `Boolean(value)`, so the query
  string `?ahead=false` turns the flag *on*. `queryBoolean` in
  `packages/contracts/src/common.ts` is the only boolean allowed in a query.
- **`z.coerce.date()` cannot be described in OpenAPI.** nestjs-zod emits an
  empty schema for any `ZodDate`, so every timestamp in the published document
  said nothing at all — including `reviewedAt`, the one value an offline client
  must get right. `isoDate` is a string schema with a `.transform()`; `.pipe()`
  is not understood either. Verified against the generated document, not
  assumed.
- **Swagger does not read return types.** @nestjs/swagger documents a response
  body only with an explicit decorator or the build-time plugin. Before
  `common/api-responses.ts` existed, all 33 operations published *zero*
  response schemas while the docs page still looked complete.
- **The review pre-check was removed.** Asking "has this id been seen?" before
  inserting is a second mechanism competing with the primary key, and a round
  trip per review — 200 extra queries on a full offline batch. The unique
  constraint decides it; P2002 is read as "already had this one".
- **Reviews in a batch are applied one at a time, oldest first.** Two reviews
  of the same card are not independent: the second one's interval is computed
  from the state the first left behind. In parallel they would both read the
  same starting state and the later write would silently discard the earlier
  review. There is an integration test that fails if this is ever parallelised.
- **The streak moves forward only.** An offline batch from last week adds to
  the log and the heatmap but does not retroactively repair a broken streak.
  Recomputing it would mean scanning the whole log on every single review.
- Day bucketing is **UTC**, in `common/dates.ts`. Per-user timezones are a real
  feature and a later one; the server's local zone would make the streak break
  at midnight in whatever region the container happens to run in.
- `/optimizer/run` **saves nothing**. It returns a proposal with the backtest
  attached, because the workload change is frequently *upward* and the user
  should see that before adopting it. Fitting runs inline with a capped
  iteration count, a capped training window and a 24-hour per-user cooldown —
  a worker thread is the right answer at scale and is not pretended here.
- Local integration runs hit Neon over the network, so the suite takes minutes
  and has produced one transient 500 under sustained load. CI runs a Postgres
  container on the same host and is an order of magnitude faster.

### Notes carried out of phase 3

- The optimizer is a **separate package** from `fsrs` on purpose: it is
  server-only, and the browser must never pull gradient descent into its bundle.
- Training refuses below `MIN_REVIEWS` (400). Below that the fit follows noise
  and does worse than the published defaults. Returning noise would be worse
  than returning nothing.
- Parameter bounds were derived by probing `clipParameters`, not read from the
  exported table — reading it directly gave `[0, 0.1542]` for w[17], which
  cannot be right when the published default is 0.5425.
- `evaluate` must NOT read the stability/difficulty stored on review rows.
  Those belong to whatever parameters were live at the time; every candidate
  produces its own, so history is replayed from the ratings. This is the
  concrete reason `Review` is append-only.
- **The optimizer does not promise less studying.** Measured on simulated
  learners: a fast forgetter gets *more* daily reviews (+48%), a slow forgetter
  fewer (−27%). It promises accuracy. Never phrase it as a workload saving.

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
   There is no 403 in this API: not-yours and not-there are the same 404, so a
   guessed id cannot be confirmed.
7. **No secret in a client bundle.** Nothing sensitive behind `NEXT_PUBLIC_`.
   v1 leaked its AI key exactly this way.
8. **Logic that mobile will need goes in `packages/core`**, not in a component.
   Slipping here is what makes the mobile app cost 2x instead of 0.5x.
9. **No raw hex outside `packages/tokens`.** Lint enforces it.
10. **Ask before large refactors or destructive changes.**
11. **The forgetting curve, "why this card?", the retention slider and the
    optimizer stay free.** They are the only reason to pick this over Anki;
    charging for them would remove the differentiator in order to sell it. Only
    AI generation (real marginal cost), the Memory Report, and convenience
    features are ever candidates for a paid tier. See `01-PRODUCT.md`,
    "On charging money" — including the honest note that this is expected to
    earn very little and is not why the project exists.

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
