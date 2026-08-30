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

  decks         Deck[]
  cards         Card[]
  reviews       Review[]
  refreshTokens RefreshToken[]
  stats         UserStats?
  aiUsage       AiUsage[]
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
- Mutations that can be retried accept `Idempotency-Key`

## Endpoints

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh          rotation + reuse detection
POST   /auth/logout           revokes the whole family
GET    /auth/me

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

GET    /review/queue?deckId=&limit=   the due queue
POST   /review                        submit one   (Idempotency-Key)
POST   /review/batch                  offline sync (see 05)
GET    /review/history?cardId=
GET    /review/explain/:cardId        "why this card?" — S, D, R, forget date

POST   /ai/generate           topic|text -> cards. Rate limited + capped
GET    /ai/usage              remaining quota for this user

POST   /optimizer/run         train params on this user's review log
GET    /optimizer/backtest    default vs optimised: retention + workload
POST   /optimizer/apply       write params to User

GET    /stats/overview        xp, level, streak
GET    /stats/heatmap?days=365
GET    /stats/forecast?days=30
GET    /stats/curve?deckId=   forgetting curve series

POST   /import/anki           .apkg upload -> decks, cards, review history
POST   /import/csv            same pipeline, simpler source
POST   /report                build a Memory Report from a history
GET    /report/:id            fetch one

GET    /health                liveness  (also the uptime ping target)
GET    /ready                 readiness — checks DB
GET    /docs                  Swagger UI
GET    /docs-json             OpenAPI document
```

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
// packages/contracts/ai.ts
export const GeneratedCard = z.object({
  front: z.string().min(3).max(300),
  back:  z.string().min(1).max(2000),
  hint:  z.string().max(200).optional(),
});
export const GenerateResponse = z.object({
  cards: z.array(GeneratedCard).min(1).max(20),
});
```

Pipeline: prompt → Groq → parse → **validate with Zod** → reject and retry once
on failure → persist. The model never writes to the database directly; only
Zod-validated output does.

Caps, enforced in `ai` module before the call:

| Limit | Value | Why |
|---|---|---|
| Per request | 20 cards | |
| Per user per day | 100 cards | |
| Per user per minute | 3 requests | Groq is 30 rpm account-wide |
| Demo account | 5 cards/day | recruiters can try it; nobody can drain it |

The per-user daily figure is read from the user's stored allowance rather than
a constant. Generation is the only feature with a real marginal cost, so it is
the only honest candidate for a paid tier later (see `01-PRODUCT.md`, "On
charging money"). Storing the number now keeps that a config change instead of
a refactor. There is no billing and no plans table, and none is planned until
the free product has users.
