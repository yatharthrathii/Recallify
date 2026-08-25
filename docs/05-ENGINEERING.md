# 05 — Engineering Practice

## Performance budget

Numbers, not intentions. CI fails the build when these regress.

| Metric | Budget | Enforced by |
|---|---|---|
| LCP (landing, mobile 4G) | < 1.5s | Lighthouse CI |
| CLS | < 0.05 | Lighthouse CI |
| INP | < 200ms | Lighthouse CI |
| **Rating a card → next card visible** | **< 50ms** | manual + trace; fully local |
| Initial JS (landing) | < 110 KB gz | `size-limit` |
| Initial JS (app shell) | < 180 KB gz | `size-limit` |
| API p95 (due queue) | < 120ms | logged |
| Lighthouse Performance / A11y | >= 95 | Lighthouse CI |

The 50ms number is the one that matters. Rating a card must never wait on the
network — `packages/fsrs` computes the next state locally, the UI advances
immediately, and the write goes out in the background.

## Loading states

Rules, so this is consistent everywhere:

1. **Skeletons must match the final layout exactly** — same dimensions, same
   spacing. A skeleton that causes layout shift is worse than a spinner.
2. **Never spinners for content.** Skeleton for structure, spinner only inside a
   button that is doing something.
3. **Suspense boundary per independent section**, not one per page. The stats
   page streams the heatmap, curve, and forecast separately.
4. **Optimistic by default for mutations.** Create a deck → it appears instantly
   with a subtle pending state → reconciles or rolls back with a toast.
5. **Prefetch on intent** — `onMouseEnter` / `onFocus` of a deck card prefetches
   its due queue. By the time the click lands the data is there.
6. **The review queue is fetched once per session**, not per card.

## Code splitting and lazy loading

| Split | Why |
|---|---|
| Route-level (App Router default) | baseline |
| `ForgettingCurve` + `d3-shape` | lazy — only `/stats` and card detail need it |
| `Heatmap` | lazy, below the fold |
| Command palette | lazy on first Cmd-K |
| CSV import parser | lazy on dialog open |
| Optimizer results view | lazy — rarely opened |
| `next/image` for all raster assets | AVIF/WebP, explicit dimensions |
| `next/font` for Fraunces + Plex | self-hosted, preloaded, `swap` |

The review route stays deliberately fat-free: FSRS + the card component and
nothing else. It is the hot path.

## Offline sync — mobile

The key insight that makes this tractable:

> **Reviews are an append-only event log with client-generated UUIDs.**
> That turns "sync" into "idempotent replay", not "conflict resolution".

```
OFFLINE
  user rates a card
    ├─ packages/fsrs computes next state locally
    ├─ write Review row to local SQLite  (id = uuid v4, generated on device)
    ├─ update local Card state
    └─ enqueue the review id in outbox

RECONNECT  (NetInfo fires)
    ├─ POST /review/batch  { reviews: [...] }   up to 200 per call
    ├─ server sorts by reviewedAt, replays each through FSRS
    ├─ duplicate id  ->  ignored, returns the stored result (idempotent)
    ├─ response: authoritative Card states
    └─ client overwrites local Card rows; clears the outbox
```

Because the review id is generated on the device and is the primary key, a retry
after a half-failed request cannot double-count. The `Idempotency-Key` header on
the single-review endpoint does the same job for the web client.

**Mutable entities** (deck title, card text) use last-write-wins on `updatedAt`.
This is a single-user-per-account product; two devices editing the same card text
within the same second is not a real scenario, and pretending otherwise would
mean building CRDTs for no user benefit. Document the choice; do not build for it.

Local store: `expo-sqlite` + Drizzle. WatermelonDB's sync protocol is not needed
because our sync is one-directional replay, and Drizzle gives type-safe live
queries that match how the web app already reads data.

## Testing

| Layer | Tool | Target | What is actually tested |
|---|---|---|---|
| `packages/fsrs` | Vitest + fast-check | **100%** | the algorithm |
| `packages/optimizer` | Vitest | **100%** | convergence, loss decreases |
| API unit | Vitest | ~70% | services, guards |
| API integration | Vitest + Supertest + Postgres service container | auth + reviews fully | real DB, real HTTP |
| Web components | Testing Library | key flows | review session, forms |
| E2E | Playwright | 3 flows | see below |

Coverage is enforced only where it means something: the algorithm and the auth
flow. Everywhere else, chasing a percentage produces tests that assert nothing.

### Property-based tests for FSRS

These are the ones worth writing. They encode invariants the algorithm must never
break, and `fast-check` generates thousands of cases trying to break them:

```
for any card state and elapsed time:
  · rating Easy always yields interval >= rating Good
  · rating Good always yields interval >= rating Hard
  · rating Again always resets state to RELEARNING and lapses += 1
  · stability is strictly positive
  · difficulty stays within [1, 10]
  · retrievability decreases monotonically as elapsed days increase
  · retrievability is in [0, 1] for every input
  · replaying an identical review log always produces identical state
```

### Differential test against `ts-fsrs`

`ts-fsrs` is the reference implementation (766 stars, ~133k weekly downloads).
We do not depend on it in production — we install it as a **dev dependency** and
assert our implementation matches it across 19,000 generated cases.

```
generate random (state, rating, elapsedDays, params)
  ours      -> next state A
  ts-fsrs   -> next state B
  assert A ≈ B  within 1e-6
```

This is what makes "I implemented FSRS from the published algorithm" a provable
claim rather than an assertion. It also means we know about the ecosystem, which
is the correct posture — see the interview framing in `08-ROADMAP.md`.

### E2E flows (Playwright, in CI)

1. register → create deck → add card → review it → due date changes
2. demo login → stats page → curve renders with data
3. AI generate → cards validated and persisted → appear in deck

## CI — GitHub Actions

```yaml
on: [push, pull_request]

lint-and-type:   pnpm lint · pnpm typecheck        # zero warnings allowed
test-unit:       pnpm test --coverage              # fsrs must stay at 100%
test-integration: services: postgres:16            # real database
build:           pnpm build (turbo cached)
e2e:             playwright, on PRs to main
size:            size-limit — fails on budget regression
lighthouse:      LHCI against the preview deployment
```

Badges in the README: CI status, coverage, uptime. All three are free and all
three are checked in the first 60 seconds by anyone evaluating the repo.

v1 currently fails `npm run lint` with one error and six warnings and nobody
caught it, because there was no CI. That is the whole argument for this section.

## Observability

- `pino` structured JSON logs; pretty-printed locally
- `X-Request-Id` generated at the edge, threaded through every log line, returned
  in every response, and surfaced in the UI on error so a bug report is actionable
- Sentry on API and web, with the release SHA attached
- `/health` (liveness) and `/ready` (checks the DB) — `/health` is also the
  uptime-ping target that keeps Neon awake
- Every AI call logs tokens in and out to `AiUsage`; cost is a chart, not a guess

## Security checklist

- [ ] argon2id password hashing
- [ ] Refresh token rotation **with reuse detection** (revoke the whole family)
- [ ] Refresh token stored as a SHA-256 hash, never plaintext
- [ ] `httpOnly` + `Secure` + `SameSite=Lax` cookie on web; SecureStore on mobile
- [ ] Access token never written to `localStorage`
- [ ] Zod validation on every single request body, query, and param
- [ ] Every query scoped by `userId` — ownership enforced in the `where`, not after
- [ ] Rate limits: global, per-IP on auth, per-user on AI
- [ ] Helmet, CORS locked to known origins
- [ ] Prisma parameterises everything — no raw SQL without `Prisma.sql`
- [ ] No secret ever prefixed `NEXT_PUBLIC_` or `VITE_` — **v1 leaked its
      OpenRouter key into the production bundle exactly this way**
- [ ] `.env.example` complete; `.env` git-ignored (v1 got this right — keep it)
- [ ] `pnpm audit` and Dependabot in CI
- [ ] Demo account is read-mostly: capped AI, cannot delete seeded decks

## Definition of done — per feature

1. Zod contract written in `packages/contracts` first
2. API endpoint + unit test + integration test
3. Swagger renders it correctly with an example
4. Web UI with loading, empty, and error states — all three, always
5. Keyboard accessible, focus visible, AA contrast verified
6. Uses only tokens from `packages/tokens`
7. Works in light and dark
8. Logic lives in `packages/core` if mobile will need it
9. No new lint warning, no size-limit regression
10. README updated **only if the claim is now true**
