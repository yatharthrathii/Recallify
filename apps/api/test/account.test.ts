import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  API,
  auth,
  deleteUsers,
  registerUser,
  startHarness,
  type Harness,
  type TestUser,
} from './harness';

describe('account and settings', () => {
  let h: Harness;
  const users: TestUser[] = [];

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    await deleteUsers(h, ...users);
    await h.close();
  });

  async function fresh(label: string): Promise<TestUser> {
    const user = await registerUser(h, label);
    users.push(user);
    return user;
  }

  it('updates the retention target and daily limits', async () => {
    const user = await fresh('settings');

    const res = await h
      .http()
      .patch(`${API}/auth/me`)
      .set(auth(user))
      .send({ desiredRetention: 0.85, dailyNewLimit: 10, displayName: 'Yatharth' })
      .expect(200);

    expect(res.body).toMatchObject({
      desiredRetention: 0.85,
      dailyNewLimit: 10,
      displayName: 'Yatharth',
      // Untouched fields keep their values.
      dailyReviewLimit: 200,
    });
  });

  it('refuses a retention target outside the range the model supports', async () => {
    const user = await fresh('bad-retention');

    await h
      .http()
      .patch(`${API}/auth/me`)
      .set(auth(user))
      .send({ desiredRetention: 0.5 })
      .expect(400);
  });

  it('schedules with the new target from the next review on', async () => {
    const user = await fresh('retarget');
    const deckId = (
      await h.http().post(`${API}/decks`).set(auth(user)).send({ title: 'Retarget' }).expect(201)
    ).body.id as string;

    await h.http().patch(`${API}/auth/me`).set(auth(user)).send({ desiredRetention: 0.8 }).expect(200);

    await h
      .http()
      .post(`${API}/cards`)
      .set(auth(user))
      .send({ deckId, front: 'q', back: 'a' })
      .expect(201);

    const queue = await h.http().get(`${API}/review/queue`).set(auth(user)).expect(200);

    // The queue tells the client what it is being scheduled with, so the local
    // scheduler and the server agree.
    expect(queue.body.config.desiredRetention).toBe(0.8);
    expect(queue.body.config.params).toHaveLength(21);
    expect(queue.body.cards[0]).toMatchObject({ state: 'NEW', reps: 0, stability: 0 });
  });

  it('deletes the account only with the right password', async () => {
    const user = await registerUser(h, 'doomed');
    const deckId = (
      await h.http().post(`${API}/decks`).set(auth(user)).send({ title: 'Mine' }).expect(201)
    ).body.id as string;
    const card = await h
      .http()
      .post(`${API}/cards`)
      .set(auth(user))
      .send({ deckId, front: 'q', back: 'a' })
      .expect(201);
    await h
      .http()
      .post(`${API}/review`)
      .set(auth(user))
      .send({
        id: randomUUID(),
        cardId: card.body.id,
        rating: 3,
        reviewedAt: new Date().toISOString(),
      })
      .expect(200);

    await h
      .http()
      .delete(`${API}/auth/me`)
      .set(auth(user))
      .send({ password: 'not-the-password' })
      .expect(401);
    expect(await h.prisma.user.count({ where: { id: user.id } })).toBe(1);

    await h
      .http()
      .delete(`${API}/auth/me`)
      .set(auth(user))
      .send({ password: 'correct-horse-battery' })
      .expect(204);

    // Everything the account owned goes with it.
    expect(await h.prisma.user.count({ where: { id: user.id } })).toBe(0);
    expect(await h.prisma.deck.count({ where: { userId: user.id } })).toBe(0);
    expect(await h.prisma.review.count({ where: { userId: user.id } })).toBe(0);
    expect(await h.prisma.refreshToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it('prices every retention target in one response', async () => {
    const user = await fresh('workload');
    const deckId = (
      await h.http().post(`${API}/decks`).set(auth(user)).send({ title: 'Load' }).expect(201)
    ).body.id as string;
    await h
      .http()
      .post(`${API}/cards/bulk`)
      .set(auth(user))
      .send({
        deckId,
        cards: Array.from({ length: 6 }, (_, i) => ({ front: `q${i}`, back: `a${i}` })),
      })
      .expect(201);
    await h.prisma.card.updateMany({
      where: { deckId },
      data: { state: 'REVIEW', stability: 30, difficulty: 5, lastReviewedAt: new Date() },
    });

    const res = await h.http().get(`${API}/stats/workload`).set(auth(user)).expect(200);

    expect(res.body.cardsCounted).toBe(6);
    expect(res.body.points).toHaveLength(28);

    // A higher target means shorter intervals, so more reviews a day. If this
    // ever runs the other way the slider is lying.
    const perDay = res.body.points.map((p: { reviewsPerDay: number }) => p.reviewsPerDay);
    for (let i = 1; i < perDay.length; i += 1) {
      expect(perDay[i]).toBeGreaterThanOrEqual(perDay[i - 1]);
    }
    expect(perDay.at(-1)).toBeGreaterThan(perDay[0]);
  });
});
