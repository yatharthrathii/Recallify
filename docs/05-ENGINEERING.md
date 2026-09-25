# 05 — Engineering Practice

## Performance budget

Numbers, not intentions. The table says what was measured in phase 7 and
which of them CI actually enforces; a budget nothing checks is a wish, and it
is marked as one.

| Metric | Budget | Measured, phase 7 | Enforced by |
|---|---|---|---|
| **Rating a card, next card visible** | **< 50ms** | local, no request | design: fully local |
| Lighthouse accessibility, best practices, SEO | >= 95 | 100 on all four public pages | Lighthouse CI, fails the job |
| Lighthouse performance (simulated mobile) | >= 80 | 85 to 87 | Lighthouse CI, warns only |
| CLS | < 0.1 | 0.000 | Lighthouse CI, fails the job |
| Script transferred (public pages) | < 400 KB | 250 to 326 KB | Lighthouse CI, fails the job |
| FSRS engine, brotli | < 9 KB | 7.5 KB | `size-limit`, fails the build |
| Web client JS, all chunks, brotli | < 500 KB | 429 KB | `size-limit`, fails the build |
| LCP (simulated mobile 4G) | < 2.5s | about 4s | not enforced |

Performance is a warning rather than a failure because a shared CI runner's
timing is not a measurement of the site. LCP is the honest gap: the landing
headline animates in word by word, and Lighthouse counts the paint as late.
The original targets of 1.5s LCP and 95 performance were written before any
measurement existed and were not met; they stay out of the table rather than
being claimed.

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
| E2E | Playwright | 5 files, desktop and phone | see below |

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

`apps/e2e`, run against the production builds of both apps on a Postgres
service container, because the service worker only exists in a production
build.

1. Every public page renders, fits a phone screen and throws nothing; every
   internal link on the front page resolves; the only outbound link is the
   maker's profile.
2. Register, sign out, sign in; a wrong password; the password toggle; forgot
   and reset password pages.
3. Make a deck, add a card, review it, and see it counted by the server.
4. Open the demo: history deep enough for the optimizer to be offered.
5. Offline: the review screen reopens with no connection, an answer waits in
   the outbox and is sent on reconnect, and signing out removes cached cards.

AI generation is not in E2E: it would spend the live model quota on every
push. It is covered by integration tests with a scripted provider.

## CI — GitHub Actions

```yaml
on: push to main, and every pull request

quality:      lint (zero warnings), typecheck, build, size-limit
test:         package unit tests; fsrs must stay at 100% coverage
integration:  API tests on a postgres:16 service container
e2e:          Playwright on the production builds, postgres:16
lighthouse:   public pages served by next start, assertions in lighthouserc.json
```

`uptime.yml` runs on a schedule: the live API's `/health` every 30 minutes and
`/ready` (which touches the database) once a day, so the check does not keep the
Neon compute awake and spend the free tier's hours. A failure emails the owner.

Badges in the README: CI status and uptime.

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
