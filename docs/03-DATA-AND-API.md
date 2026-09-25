# 03 — Data Model & API

## Principles

1. **`Review` is append-only.** It is the event log the forgetting curve, the
   optimizer, and the backtest are all computed from. Never update, never delete.
   Card state is a *derived cache* of replaying that log.
2. **Zod is the single source of truth.** `packages/contracts` defines each
   schema once; it produces request validation, TypeScript types for all three
   apps, and the OpenAPI document. There is no second definition anywhere.
3. **Every user-owned row is scoped by `userId` in the query**, not just checked
   afterwards. A missing `where userId` is a data leak, not a bug.

## Schema

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  displayName   String?
  createdAt     DateTime @default(now())

  // FSRS personalisation
  fsrsParams        Float[]  // 21 params; empty = use defaults
  desiredRetention  Float    @default(0.90)
  dailyNewLimit     Int      @default(20)
  dailyReviewLimit  Int      @default(200)
  paramsOptimizedAt DateTime?

  aiDailyLimit  Int      @default(20)   // stored, so a paid tier is an UPDATE

  decks         Deck[]
  cards         Card[]
  reviews       Review[]
  refreshTokens RefreshToken[]
  stats         UserStats?
  aiUsage       AiUsage[]
  aiReports     AiReport[]
}

model RefreshToken {
  id         String   @id @default(cuid())
  userId     String
  tokenHash  String   @unique      // store the hash, never the token
  familyId   String                // rotation family — reuse detection
  expiresAt  DateTime
  revokedAt  DateTime?
  userAgent  String?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, familyId])
}

model Deck {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String?
  color       String   @default("amber")
  isPublic    Boolean  @default(false)
  archivedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  cards Card[]
  @@index([userId, archivedAt])
}

enum CardState  { NEW LEARNING REVIEW RELEARNING }
enum CardSource { MANUAL AI IMPORT }

model Card {
  id       String     @id @default(cuid())
  deckId   String
  userId   String                       // denormalised: every due query filters on it
  front    String
  back     String
  hint     String?
  source   CardSource @default(MANUAL)

  // FSRS state — derived from the Review log, cached here for fast queries
  state          CardState @default(NEW)
  stability      Float     @default(0)
  difficulty     Float     @default(0)
  dueAt          DateTime  @default(now())
  reps           Int       @default(0)
  lapses         Int       @default(0)
  lastReviewedAt DateTime?
  suspendedAt    DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  deck    Deck     @relation(fields: [deckId], references: [id], onDelete: Cascade)
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  reviews Review[]

  @@index([userId, dueAt])              // THE due-queue query
  @@index([deckId, dueAt])
  @@index([userId, state])
}

model Review {
  id       String @id                   // client-generated UUID = idempotency key
  cardId   String
  userId   String
  rating   Int                          // 1 Again · 2 Hard · 3 Good · 4 Easy

  // state BEFORE this review — makes the log replayable on its own
  prevState      CardState
  prevStability  Float
  prevDifficulty Float

  // outcome
  newStability  Float
  newDifficulty Float
  scheduledDays Int
  elapsedDays   Int
  retrievability Float                  // predicted R at review time
  durationMs    Int?

  reviewedAt DateTime                   // client clock — when it actually happened
  syncedAt   DateTime @default(now())   // server clock — when it arrived

  card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, reviewedAt])
  @@index([cardId, reviewedAt])
}

model UserStats {
  userId        String   @id
  xp            Int      @default(0)     // TOTAL, never modulo — v1 bug
  level         Int      @default(1)
  streak        Int      @default(0)
  longestStreak Int      @default(0)
  lastStudyDate DateTime?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AiUsage {
  id            String   @id @default(cuid())
  userId        String
  promptTokens  Int
  outputTokens  Int
  cardsCreated  Int
  model         String
  createdAt     DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt])           // rate-limit window query
}

// A snapshot of flagged AI output. Text, not a card id: a draft that was
// never saved has no id, and a report has to outlive the card.
model AiReport {
  id        String   @id @default(cuid())
  userId    String
  front     String
  back      String
  reason    String   // offensive | incorrect | other
  note      String?
  model     String?
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### v1 bugs this schema fixes, explicitly

| v1 bug | Fix |
|---|---|
| `newXP = newXP % 100` destroyed total XP | `xp` is cumulative; level is *derived* from it |
| daily XP history overwritten, not accumulated | history is derived from the `Review` log, not stored |
| XP written from two places (context + firebase.js) | one server-side writer, in `stats` module |
| ID token in `localStorage`, never refreshed, dies at 1h | rotating refresh token, httpOnly cookie |
| card was only `{question, answer}` | full FSRS state + append-only review log |

### The index that matters

`@@index([userId, dueAt])` serves the single hottest query in the product:

```sql
SELECT * FROM "Card"
WHERE "userId" = $1 AND "dueAt" <= now() AND "suspendedAt" IS NULL
ORDER BY "dueAt" ASC LIMIT 50;
```

Run `EXPLAIN ANALYZE` before and after adding it and put both numbers in the
README. One line, and it shows you think about the database rather than hoping.

## API conventions

- Base: `/api/v1`
- `snake_case` never appears; JSON is `camelCase` end to end
- Errors are RFC 9457 problem+json:
  `{ type, title, status, detail, instance, traceId }`
- Every response carries `X-Request-Id`; it is logged and shown in the UI on error
- Lists are **cursor**-paginated: `?cursor=<id>&limit=50` returns
  `{ items, nextCursor }`. Never offset — it skips rows when data shifts.
- Retries are keyed by the client's own id, not by a header. `POST /review`
  takes a device-generated UUID as the review's primary key, which makes the
  idempotency key part of the resource rather than a parallel mechanism the
  server has to remember separately. A repeat returns `applied: false`.

## Endpoints

Built and covered by integration tests, except where marked. The live document
is `/docs-json`; this table is the intent, that is the truth.

```
POST   /auth/register
POST   /auth/login            429 after 10 failures per address or 50 per client in 15 minutes
POST   /auth/refresh          rotation + reuse detection
POST   /auth/logout           revokes the whole family
POST   /auth/demo             a private account with six months of simulated history; 5 per client per hour
POST   /auth/forgot-password  emails a one-shot link; 202 whether or not the address exists
POST   /auth/reset-password   spends the link, sets the password, signs out every device
GET    /auth/me
PATCH  /auth/me               name, retention target, daily limits
DELETE /auth/me               needs the password again. Cascades to everything

GET    /decks                 cursor paginated
POST   /decks
GET    /decks/:id
PATCH  /decks/:id
DELETE /decks/:id
GET    /decks/:id/stats       due count, retention, forecast

GET    /cards?deckId=         cursor paginated
POST   /cards
POST   /cards/bulk            CSV / AI results
PATCH  /cards/:id
DELETE /cards/:id
POST   /cards/:id/suspend

GET    /review/queue?deckId=&limit=   the due queue, with full card state and the
                                      scheduling config, so clients schedule locally
POST   /review                        submit one. The body's `id` is the key.
POST   /review/batch                  offline sync (see 05)
GET    /review/history?cardId=
GET    /review/explain/:cardId        "why this card?" — S, D, R, forget date,
                                      and what each of the four buttons would do

POST   /ai/generate           topic|notes -> drafts. Saves nothing.
GET    /ai/usage              today's allowance and when it resets
POST   /ai/report             flag a draft or card as offensive or wrong

GET    /optimizer/status      enough history yet? cooldown? using fitted params?
POST   /optimizer/run         fit + backtest in one call. Saves nothing.
POST   /optimizer/apply       adopt a fitted set (re-checked against bounds)
POST   /optimizer/reset       back to the published defaults

GET    /stats/overview        xp, level, streak, measured retention
GET    /stats/heatmap?days=365
GET    /stats/forecast?days=30&deckId=
GET    /stats/curve?cardId=|deckId=   forgetting curve series
GET    /stats/workload        reviews/day at every retention target, one response

POST   /import/anki           phase 8
POST   /import/csv            phase 8
POST   /report                phase 8
GET    /report/:id            phase 8

GET    /health                liveness  (also the uptime ping target)
GET    /ready                 readiness — checks DB
GET    /docs                  Swagger UI
GET    /docs-json             OpenAPI document
```

`/optimizer/backtest` is gone as a separate endpoint. Backtesting needs the
same replay of the same review log that fitting does, so running it separately
would do the expensive half of the work twice to answer one question. `/run`
returns the fit and the comparison together, and saves neither.

## Auth flow in detail

```
register/login
  ├─ argon2id hash the password (not bcrypt — argon2id is the current default)
  ├─ access token   JWT, 15 min, in memory / Authorization header
  └─ refresh token  opaque 32-byte random, 30 days
                    stored in DB as SHA-256 hash + familyId
                    web    -> httpOnly Secure SameSite=Lax cookie
                    mobile -> expo-secure-store

refresh
  ├─ hash the presented token, look it up
  ├─ if not found            -> 401
  ├─ if revokedAt IS NOT NULL -> REUSE DETECTED
  │                              revoke the entire familyId, force re-login
  └─ else rotate: revoke this one, issue a new one with the same familyId
```

Reuse detection is the part worth explaining: if a stolen refresh token is
replayed after the legitimate client has already rotated it, both tokens belong
to the same family, so the whole family is killed and the attacker's session dies
with the user's. That is a real, small, defensible security design.

## AI generation contract

```ts
// packages/contracts/src/ai.ts
export const generatedCard = z.object({
  front: z.string().trim().min(3).max(300),
  back:  z.string().trim().min(1).max(2000),
  hint:  z.string().trim().max(200).optional(),
});
// The envelope the model returns. Cards are validated one at a time, so one
// overlong answer costs one card rather than the generation.
export const generateResponse = z.object({ cards: z.array(z.unknown()) });
```

Pipeline:

```
check deck ownership            a stranger's deck costs nothing
reserve the allowance           row lock on the user, FOR UPDATE NOWAIT
prompt -> Groq                  gpt-oss-120b, then gpt-oss-20b on any failure
parse, validate each card       drop invalid and repeated cards
  none usable? retry once       with a firmer instruction
settle the reservation          to the cards actually returned, or to zero
return drafts                   nothing is saved
```

**Drafts, not cards.** The user saves what is worth keeping through
`POST /cards/bulk` with `source: 'AI'`. The model never writes to the database,
and neither does this endpoint: measured output included a confident wrong
card, and a wrong card saved straight into a schedule gets memorised.

**Reserve, then call, then settle.** Checking the allowance, calling the model
and recording afterwards would let simultaneous requests all see the full
allowance. The check and the charge happen together, first, in one short
transaction. A failure settles to zero cards rather than deleting the row, so
the allowance is refunded but the attempt still counts per minute.

Caps:

| Limit | Value | Why |
|---|---|---|
| Per request | 20 cards | |
| Per user per day | 20 cards | stored in `User.aiDailyLimit`. At 10-20 cards a request that is one or two requests a user, so one model's 1,000 a day serves roughly 500-1,000 users, and the fallback about doubles it |
| Per user per minute | 3 requests, failed ones included | counted in the database, because serverless instances share no memory |
| Per user at once | 1 reservation | a second simultaneous request is refused, not queued |
| Notes length | 10,000 characters | ~2,500 tokens, against 8,000 tokens a minute per model for the whole app |
| Demo account | 5 cards/day | phase 7: set through the same stored allowance |

Status codes: `429` for the daily allowance, the per-minute limit and a
simultaneous request; `422` when the model returns no usable cards; `502` when
it returns something unparseable twice; `503` when every model is busy or no
key is configured. Every failure after the allowance has been reserved says
"Nothing was charged", and it is true; the ones before it -- a stranger's deck,
the limits, a missing key -- never charged anything to begin with.

The per-user daily figure is read from the user's stored allowance rather than
a constant. Generation is the only feature with a real marginal cost, so it is
the only honest candidate for a paid tier later (see `01-PRODUCT.md`, "On
charging money"). Storing the number now keeps that a config change instead of
a refactor. There is no billing and no plans table, and none is planned until
the free product has users.
