import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { reviewIdFor } from '../src/common/ids';
import { API, auth, deleteUsers, registerUser, startHarness, type Harness, type TestUser } from './harness';

const DAY = 86_400_000;

/** A card with a plausible history: Good at growing intervals, one lapse. */
function cardWithHistory(index: number, now: Date, reviews = 6) {
  const start = now.getTime() - 120 * DAY - index * DAY;
  const gaps = [0, 1, 3, 7, 16, 35, 70, 120];
  return {
    front: `Question ${index}`,
    back: `Answer ${index}`,
    reviews: Array.from({ length: reviews }, (_, i) => ({
      id: randomUUID(),
      rating: i === 2 && index % 5 === 0 ? 1 : 3,
      reviewedAt: new Date(start + (gaps[i] ?? 120 + i) * DAY).toISOString(),
      durationMs: 4000 + i * 100,
    })),
  };
}

describe('import', () => {
  let h: Harness;
  let user: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    h = await startHarness();
    user = await registerUser(h, 'importer');
    stranger = await registerUser(h, 'stranger');
  });

  afterAll(async () => {
    await deleteUsers(h, user, stranger);
    await h.close();
  });

  it('makes a deck, replays each card, and counts the history in the stats', async () => {
    const now = new Date();
    const res = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({
        newDeck: { title: 'Imported deck', color: 'teal' },
        cards: [cardWithHistory(1, now), cardWithHistory(2, now, 0), { front: 'a', back: 'b', suspended: true }],
      })
      .expect(201);

    expect(res.body).toMatchObject({ cardsCreated: 3, reviewsCreated: 6 });
    const deckId = res.body.deckId as string;

    const cards = await h.prisma.card.findMany({ where: { deckId }, orderBy: { front: 'asc' } });
    expect(cards).toHaveLength(3);
    const replayed = cards.find((c) => c.front === 'Question 1')!;
    // Six answers, one of them Again, replayed through this scheduler.
    expect(replayed.reps).toBe(6);
    expect(replayed.state).toBe('REVIEW');
    expect(replayed.stability).toBeGreaterThan(0);
    expect(replayed.source).toBe('IMPORT');
    expect(replayed.lastReviewedAt).not.toBeNull();
    expect(replayed.createdAt.getTime()).toBeLessThan(now.getTime() - 100 * DAY);

    const fresh = cards.find((c) => c.front === 'Question 2')!;
    expect(fresh.state).toBe('NEW');
    expect(fresh.reps).toBe(0);

    const suspended = cards.find((c) => c.front === 'a')!;
    expect(suspended.suspendedAt).not.toBeNull();

    // The log is what the curve is drawn from, so it must be replayable: the
    // before-state of each row is the after-state of the one before it.
    const log = await h.prisma.review.findMany({
      where: { cardId: replayed.id },
      orderBy: { reviewedAt: 'asc' },
    });
    expect(log).toHaveLength(6);
    expect(log[0]!.prevState).toBe('NEW');
    for (let i = 1; i < log.length; i += 1) {
      expect(log[i]!.prevStability).toBe(log[i - 1]!.newStability);
    }
    expect(log[5]!.newStability).toBe(replayed.stability);
    expect(log.map((r) => r.durationMs)).toEqual([4000, 4100, 4200, 4300, 4400, 4500]);

    const stats = await h.http().get(`${API}/stats/overview`).set(auth(user)).expect(200);
    expect(stats.body.totalReviews).toBe(6);
    expect(stats.body.xp).toBe(60);
    // Every review was months ago, so there is no current streak.
    expect(stats.body.streak).toBe(0);
    expect(stats.body.longestStreak).toBeGreaterThanOrEqual(1);

    const deck = await h.http().get(`${API}/decks/${deckId}`).set(auth(user)).expect(200);
    expect(deck.body).toMatchObject({ title: 'Imported deck', color: 'teal', cardCount: 3 });
  });

  it('adds to an existing deck, and refuses one that is not yours', async () => {
    const mine = (
      await h.http().post(`${API}/decks`).set(auth(user)).send({ title: 'Mine' }).expect(201)
    ).body.id as string;

    const res = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ deckId: mine, cards: [{ front: 'x', back: 'y' }] })
      .expect(201);
    expect(res.body).toEqual({ deckId: mine, cardsCreated: 1, reviewsCreated: 0 });

    await h
      .http()
      .post(`${API}/import`)
      .set(auth(stranger))
      .send({ deckId: mine, cards: [{ front: 'x', back: 'y' }] })
      .expect(404);
    expect(await h.prisma.card.count({ where: { deckId: mine } })).toBe(1);
  });

  it('refuses a history it has already stored, and adds nothing', async () => {
    const now = new Date();
    const card = cardWithHistory(9, now);
    await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ newDeck: { title: 'Once' }, cards: [card] })
      .expect(201);

    const before = await h.prisma.deck.count({ where: { userId: user.id } });
    const res = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ newDeck: { title: 'Twice' }, cards: [cardWithHistory(10, now), card] })
      .expect(409);
    expect(res.body.detail).toMatch(/imported before/);
    // The whole request rolled back: no deck, no cards, no reviews.
    expect(await h.prisma.deck.count({ where: { userId: user.id } })).toBe(before);
    expect(await h.prisma.card.count({ where: { front: 'Question 10', userId: user.id } })).toBe(0);
  });

  it('lets another account import the same file, and refuses one id twice in a request', async () => {
    const now = new Date();
    const card = cardWithHistory(21, now);
    await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ newDeck: { title: 'Shared' }, cards: [card] })
      .expect(201);
    // The same reviews, the same ids, a different person: their own copy.
    await h
      .http()
      .post(`${API}/import`)
      .set(auth(stranger))
      .send({ newDeck: { title: 'Shared' }, cards: [card] })
      .expect(201);
    expect(await h.prisma.card.count({ where: { front: 'Question 21' } })).toBe(2);

    const twice = cardWithHistory(22, now);
    const duplicated = { ...twice, reviews: [...twice.reviews, twice.reviews[0]!] };
    const res = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ newDeck: { title: 'Broken' }, cards: [duplicated] })
      .expect(400);
    expect(res.body.errors).toHaveProperty('cards');
  });

  it('clamps a review from the future to now and keeps answers in order', async () => {
    const now = new Date();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const res = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({
        newDeck: { title: 'Clocks' },
        cards: [
          {
            front: 'q',
            back: 'a',
            reviews: [
              // Sent out of order; the later one is a year ahead.
              { id: ids[0], rating: 3, reviewedAt: new Date(now.getTime() + 365 * DAY).toISOString() },
              { id: ids[1], rating: 3, reviewedAt: new Date(now.getTime() - 10 * DAY).toISOString() },
              { id: ids[2], rating: 3, reviewedAt: new Date(now.getTime() - 20 * DAY).toISOString() },
            ],
          },
        ],
      })
      .expect(201);

    // Stored under ids that fold the account in, so another account's import
    // of the same file cannot collide with this one.
    const stored = ids.map((id) => reviewIdFor(user.id, id));
    const log = await h.prisma.review.findMany({
      where: { id: { in: stored } },
      orderBy: { reviewedAt: 'asc' },
    });
    expect(log.map((r) => r.id)).toEqual([stored[2], stored[1], stored[0]]);
    expect(log[2]!.reviewedAt.getTime()).toBeLessThanOrEqual(Date.now());
    const card = await h.prisma.card.findFirst({ where: { deckId: res.body.deckId } });
    expect(card!.reps).toBe(3);
  });

  it('validates the shape: one deck target, size caps, and review ids', async () => {
    const both = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ deckId: 'clzzzzzzzzzzzzzzzzzzzzzzz', newDeck: { title: 'x' }, cards: [{ front: 'a', back: 'b' }] })
      .expect(400);
    expect(both.body.errors).toHaveProperty('deckId');

    const neither = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ cards: [{ front: 'a', back: 'b' }] })
      .expect(400);
    expect(neither.body.errors).toHaveProperty('deckId');

    const tooMany = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({
        newDeck: { title: 'x' },
        cards: Array.from({ length: 501 }, (_, i) => ({ front: `q${i}`, back: 'a' })),
      })
      .expect(400);
    expect(tooMany.body.errors).toHaveProperty('cards');

    const badId = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({
        newDeck: { title: 'x' },
        cards: [{ front: 'a', back: 'b', reviews: [{ id: 'not-a-uuid', rating: 3, reviewedAt: new Date().toISOString() }] }],
      })
      .expect(400);
    expect(Object.keys(badId.body.errors)[0]).toMatch(/^cards\.0\.reviews\.0\.id/);
  });

  it('accepts a body far larger than the old 100 kB default', async () => {
    const now = new Date();
    const cards = Array.from({ length: 200 }, (_, i) => cardWithHistory(1000 + i, now, 8));
    const res = await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ newDeck: { title: 'Big' }, cards })
      .expect(201);
    expect(res.body).toMatchObject({ cardsCreated: 200, reviewsCreated: 1600 });
  });
});
