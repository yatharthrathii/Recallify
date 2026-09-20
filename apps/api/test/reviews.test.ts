import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, auth, deleteUsers, registerUser, startHarness, type Harness, type TestUser } from './harness';

describe('reviews', () => {
  let h: Harness;
  let user: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    h = await startHarness();
    user = await registerUser(h, 'reviewer');
    stranger = await registerUser(h, 'outsider');
  });

  afterAll(async () => {
    await deleteUsers(h, user, stranger);
    await h.close();
  });

  async function deckWithCards(owner: TestUser, count: number, title = 'Deck'): Promise<{
    deckId: string;
    cardIds: string[];
  }> {
    const deckId = (
      await h.http().post(`${API}/decks`).set(auth(owner)).send({ title }).expect(201)
    ).body.id as string;

    if (count === 1) {
      const card = await h
        .http()
        .post(`${API}/cards`)
        .set(auth(owner))
        .send({ deckId, front: 'q', back: 'a' })
        .expect(201);
      return { deckId, cardIds: [card.body.id as string] };
    }

    await h
      .http()
      .post(`${API}/cards/bulk`)
      .set(auth(owner))
      .send({ deckId, cards: Array.from({ length: count }, (_, i) => ({ front: `q${i}`, back: `a${i}` })) })
      .expect(201);

    const cards = await h.prisma.card.findMany({
      where: { deckId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return { deckId, cardIds: cards.map((c) => c.id) };
  }

  it('moves a new card into learning and writes one log row', async () => {
    const { cardIds } = await deckWithCards(user, 1, 'First review');
    const cardId = cardIds[0]!;

    const res = await h
      .http()
      .post(`${API}/review`)
      .set(auth(user))
      .send({ id: randomUUID(), cardId, rating: 3, reviewedAt: new Date().toISOString() })
      .expect(200);

    expect(res.body.applied).toBe(true);
    expect(res.body.card.state).toBe('LEARNING');
    expect(res.body.card.reps).toBe(1);
    expect(res.body.card.stability).toBeGreaterThan(0);
    expect(res.body.card.difficulty).toBeGreaterThanOrEqual(1);
    expect(res.body.card.difficulty).toBeLessThanOrEqual(10);

    const logs = await h.prisma.review.findMany({ where: { cardId } });
    expect(logs).toHaveLength(1);
    // The before-state is what makes the log replayable without the card.
    expect(logs[0]!.prevState).toBe('NEW');
    expect(logs[0]!.prevStability).toBe(0);
  });

  it('stores a replayed review id once and does not double-count it', async () => {
    const { cardIds } = await deckWithCards(user, 1, 'Idempotent');
    const cardId = cardIds[0]!;
    const reviewId = randomUUID();
    const body = { id: reviewId, cardId, rating: 3, reviewedAt: new Date().toISOString() };

    const first = await h.http().post(`${API}/review`).set(auth(user)).send(body).expect(200);
    expect(first.body.applied).toBe(true);

    const replay = await h.http().post(`${API}/review`).set(auth(user)).send(body).expect(200);
    expect(replay.body.applied).toBe(false);

    // One row, one rep, and the card is exactly where the first review left it.
    expect(await h.prisma.review.count({ where: { cardId } })).toBe(1);
    expect(replay.body.card.reps).toBe(1);
    expect(replay.body.card.dueAt).toBe(first.body.card.dueAt);
  });

  it('survives the same review arriving twice at once', async () => {
    const { cardIds } = await deckWithCards(user, 1, 'Race');
    const cardId = cardIds[0]!;
    const body = { id: randomUUID(), cardId, rating: 3, reviewedAt: new Date().toISOString() };

    // A double-tap on a slow connection. The unique primary key is what
    // actually decides this, not a check-then-insert.
    const [a, b] = await Promise.all([
      h.http().post(`${API}/review`).set(auth(user)).send(body),
      h.http().post(`${API}/review`).set(auth(user)).send(body),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.body.applied, b.body.applied].filter(Boolean)).toHaveLength(1);
    expect(await h.prisma.review.count({ where: { cardId } })).toBe(1);
  });

  it("refuses to review another user's card", async () => {
    const { cardIds } = await deckWithCards(user, 1, 'Private');
    const cardId = cardIds[0]!;

    await h
      .http()
      .post(`${API}/review`)
      .set(auth(stranger))
      .send({ id: randomUUID(), cardId, rating: 3, reviewedAt: new Date().toISOString() })
      .expect(404);

    expect(await h.prisma.review.count({ where: { cardId } })).toBe(0);
  });

  it('ignores a device clock set far in the future', async () => {
    const { cardIds } = await deckWithCards(user, 1, 'Bad clock');
    const cardId = cardIds[0]!;
    const year2100 = new Date('2100-01-01T00:00:00.000Z');

    await h
      .http()
      .post(`${API}/review`)
      .set(auth(user))
      .send({ id: randomUUID(), cardId, rating: 3, reviewedAt: year2100.toISOString() })
      .expect(200);

    const log = await h.prisma.review.findFirstOrThrow({ where: { cardId } });
    // Trusting it would have parked the card 75 years out, where nothing brings
    // it back.
    expect(log.reviewedAt.getFullYear()).toBeLessThan(2100);
  });

  it('applies an offline batch oldest first and reports duplicates', async () => {
    const solo = await registerUser(h, 'offline');
    try {
      const { cardIds } = await deckWithCards(solo, 1, 'Batch');
      const cardId = cardIds[0]!;

      const day = 86_400_000;
      const base = Date.now() - 5 * day;
      const ids = [randomUUID(), randomUUID(), randomUUID()];

      // Deliberately shuffled, the way a queue drains.
      const reviews = [
        { id: ids[2], cardId, rating: 3, reviewedAt: new Date(base + 2 * day).toISOString() },
        { id: ids[0], cardId, rating: 3, reviewedAt: new Date(base).toISOString() },
        { id: ids[1], cardId, rating: 3, reviewedAt: new Date(base + day).toISOString() },
      ];

      const res = await h
        .http()
        .post(`${API}/review/batch`)
        .set(auth(solo))
        .send({ reviews })
        .expect(200);

      expect(res.body.applied).toBe(3);
      expect(res.body.duplicates).toBe(0);

      const stored = await h.prisma.review.findMany({
        where: { cardId },
        orderBy: { reviewedAt: 'asc' },
      });
      expect(stored.map((r) => r.id)).toEqual(ids);

      // Each review started from the state the previous one left behind. This
      // is the property that would break if the batch ran in parallel: they
      // would all read the same starting state and the last writer would win.
      expect(stored[0]!.prevState).toBe('NEW');
      expect(stored[1]!.prevState).not.toBe('NEW');
      expect(stored[1]!.prevStability).toBeCloseTo(stored[0]!.newStability, 10);
      expect(stored[2]!.prevStability).toBeCloseTo(stored[1]!.newStability, 10);
      expect(stored[2]!.prevDifficulty).toBeCloseTo(stored[1]!.newDifficulty, 10);

      // Resending the whole batch is safe -- that is the point of the id.
      const resent = await h
        .http()
        .post(`${API}/review/batch`)
        .set(auth(solo))
        .send({ reviews })
        .expect(200);

      expect(resent.body.applied).toBe(0);
      expect(resent.body.duplicates).toBe(3);
      expect(await h.prisma.review.count({ where: { cardId } })).toBe(3);
    } finally {
      await deleteUsers(h, solo);
    }
  });

  it('caps new cards per day and leaves the rest for tomorrow', async () => {
    const solo = await registerUser(h, 'capped');
    try {
      await h.prisma.user.update({
        where: { id: solo.id },
        data: { dailyNewLimit: 3 },
      });

      const { cardIds } = await deckWithCards(solo, 10, 'Capped');

      const before = await h.http().get(`${API}/review/queue`).set(auth(solo)).expect(200);
      expect(before.body.cards).toHaveLength(3);
      expect(before.body.newRemainingToday).toBe(3);

      // Study all three. They leave NEW, so the allowance is spent.
      for (const cardId of cardIds.slice(0, 3)) {
        await h
          .http()
          .post(`${API}/review`)
          .set(auth(solo))
          .send({ id: randomUUID(), cardId, rating: 3, reviewedAt: new Date().toISOString() })
          .expect(200);
      }

      const after = await h.http().get(`${API}/review/queue`).set(auth(solo)).expect(200);
      expect(after.body.newRemainingToday).toBe(0);
      // Whatever is in the queue now is the learning cards coming back, not
      // more new ones.
      expect(after.body.cards.every((c: { state: string }) => c.state !== 'NEW')).toBe(true);
    } finally {
      await deleteUsers(h, solo);
    }
  });

  it('keeps suspended cards out of the queue', async () => {
    const solo = await registerUser(h, 'queue-suspend');
    try {
      const { cardIds } = await deckWithCards(solo, 3, 'Suspended');
      await h
        .http()
        .post(`${API}/cards/${cardIds[0]}/suspend`)
        .set(auth(solo))
        .send({ suspended: true })
        .expect(200);

      const res = await h.http().get(`${API}/review/queue`).set(auth(solo)).expect(200);
      expect(res.body.cards.map((c: { id: string }) => c.id)).not.toContain(cardIds[0]);
      expect(res.body.cards).toHaveLength(2);
    } finally {
      await deleteUsers(h, solo);
    }
  });

  it('explains why a card is due, with what each button would do', async () => {
    const { cardIds } = await deckWithCards(user, 1, 'Explain');
    const cardId = cardIds[0]!;

    await h
      .http()
      .post(`${API}/review`)
      .set(auth(user))
      .send({ id: randomUUID(), cardId, rating: 3, reviewedAt: new Date().toISOString() })
      .expect(200);

    const res = await h.http().get(`${API}/review/explain/${cardId}`).set(auth(user)).expect(200);

    expect(res.body.cardId).toBe(cardId);
    expect(res.body.retrievability).toBeGreaterThan(0);
    expect(res.body.retrievability).toBeLessThanOrEqual(1);
    expect(res.body.stability).toBeGreaterThan(0);

    // The ordering that makes the buttons mean what they say.
    const p = res.body.projectedIntervals;
    expect(p.again).toBeLessThanOrEqual(p.hard);
    expect(p.hard).toBeLessThanOrEqual(p.good);
    expect(p.good).toBeLessThanOrEqual(p.easy);
  });

  it('returns the append-only log newest first', async () => {
    const solo = await registerUser(h, 'history');
    try {
      const { cardIds } = await deckWithCards(solo, 1, 'History');
      const cardId = cardIds[0]!;
      const day = 86_400_000;

      await h
        .http()
        .post(`${API}/review/batch`)
        .set(auth(solo))
        .send({
          reviews: [0, 1, 2].map((i) => ({
            id: randomUUID(),
            cardId,
            rating: 3,
            reviewedAt: new Date(Date.now() - (3 - i) * day).toISOString(),
          })),
        })
        .expect(200);

      const res = await h
        .http()
        .get(`${API}/review/history?cardId=${cardId}`)
        .set(auth(solo))
        .expect(200);

      expect(res.body.items).toHaveLength(3);
      const times = res.body.items.map((r: { reviewedAt: string }) => Date.parse(r.reviewedAt));
      expect(times).toEqual([...times].sort((a, b) => b - a));
    } finally {
      await deleteUsers(h, solo);
    }
  });

  it('awards cumulative xp and never resets it at a level boundary', async () => {
    const solo = await registerUser(h, 'xp');
    try {
      const { cardIds } = await deckWithCards(solo, 12, 'XP');

      await h
        .http()
        .post(`${API}/review/batch`)
        .set(auth(solo))
        .send({
          reviews: cardIds.map((cardId) => ({
            id: randomUUID(),
            cardId,
            rating: 3,
            reviewedAt: new Date().toISOString(),
          })),
        })
        .expect(200);

      const res = await h.http().get(`${API}/stats/overview`).set(auth(solo)).expect(200);

      // v1 did `xp = xp % 100` on level-up, so 12 reviews would have left 20.
      expect(res.body.xp).toBe(120);
      expect(res.body.level).toBe(2);
      expect(res.body.streak).toBe(1);
      expect(res.body.totalReviews).toBe(12);
    } finally {
      await deleteUsers(h, solo);
    }
  });

  it('measures retention from answers, excluding first-ever reviews', async () => {
    const solo = await registerUser(h, 'retention');
    try {
      const { cardIds } = await deckWithCards(solo, 4, 'Retention');
      const now = Date.now();
      const hour = 3_600_000;

      // Introduce all four, then answer them again: two recalled, two forgotten.
      const first = cardIds.map((cardId) => ({
        id: randomUUID(),
        cardId,
        rating: 3,
        reviewedAt: new Date(now - 2 * hour).toISOString(),
      }));
      const second = cardIds.map((cardId, i) => ({
        id: randomUUID(),
        cardId,
        rating: i < 2 ? 3 : 1,
        reviewedAt: new Date(now - hour).toISOString(),
      }));

      await h
        .http()
        .post(`${API}/review/batch`)
        .set(auth(solo))
        .send({ reviews: [...first, ...second] })
        .expect(200);

      const res = await h.http().get(`${API}/stats/overview`).set(auth(solo)).expect(200);

      // 2 of 4 second-round answers recalled. The four introductions are not
      // counted -- there was nothing to recall yet.
      expect(res.body.retention).toBeCloseTo(0.5, 5);
      expect(res.body.totalReviews).toBe(8);
    } finally {
      await deleteUsers(h, solo);
    }
  });

  it('draws a card forgetting curve from its own log', async () => {
    const solo = await registerUser(h, 'curve');
    try {
      const { cardIds } = await deckWithCards(solo, 1, 'Curve');
      const cardId = cardIds[0]!;
      const day = 86_400_000;

      await h
        .http()
        .post(`${API}/review/batch`)
        .set(auth(solo))
        .send({
          reviews: [10, 5, 1].map((daysAgo) => ({
            id: randomUUID(),
            cardId,
            rating: 3,
            reviewedAt: new Date(Date.now() - daysAgo * day).toISOString(),
          })),
        })
        .expect(200);

      const res = await h
        .http()
        .get(`${API}/stats/curve?cardId=${cardId}`)
        .set(auth(solo))
        .expect(200);

      expect(res.body.points.length).toBeGreaterThan(50);
      expect(res.body.markers).toHaveLength(3);
      expect(res.body.desiredRetention).toBeCloseTo(0.9, 5);

      // Every sampled probability is a probability.
      for (const point of res.body.points) {
        expect(point.retrievability).toBeGreaterThanOrEqual(0);
        expect(point.retrievability).toBeLessThanOrEqual(1);
      }

      // The x-axis runs from the first review forward.
      const days = res.body.points.map((p: { day: number }) => p.day);
      expect(days).toEqual([...days].sort((a, b) => a - b));
    } finally {
      await deleteUsers(h, solo);
    }
  });

  it('refuses to fit parameters on too little history', async () => {
    const solo = await registerUser(h, 'optimizer');
    try {
      const status = await h.http().get(`${API}/optimizer/status`).set(auth(solo)).expect(200);
      expect(status.body.eligible).toBe(false);
      expect(status.body.usingOptimizedParams).toBe(false);

      // Below the minimum the fit follows noise, so it declines rather than
      // returning a worse model than the published defaults.
      await h.http().post(`${API}/optimizer/run`).set(auth(solo)).expect(422);
    } finally {
      await deleteUsers(h, solo);
    }
  });

  it('rejects out-of-range parameters even from its own shape', async () => {
    const solo = await registerUser(h, 'bounds');
    try {
      await h
        .http()
        .post(`${API}/optimizer/apply`)
        .set(auth(solo))
        .send({ params: Array.from({ length: 21 }, () => 9_999) })
        .expect(400);

      const user = await h.prisma.user.findUniqueOrThrow({
        where: { id: solo.id },
        select: { fsrsParams: true },
      });
      expect(user.fsrsParams).toHaveLength(0);
    } finally {
      await deleteUsers(h, solo);
    }
  });
});
