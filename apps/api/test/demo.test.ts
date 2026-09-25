import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIN_REVIEWS } from '@recallify/optimizer';
import { DemoService } from '../src/demo/demo.service';
import { API, startHarness, type Harness } from './harness';

/** A fresh client address per call, so earlier runs never count against this one. */
const fromNewClient = () => ({ 'x-client-ip': `test-${randomUUID()}` });

describe('demo accounts', () => {
  let h: Harness;
  const created: string[] = [];

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    await h.prisma.user.deleteMany({ where: { id: { in: created } } });
    await h.close();
  });

  async function openDemo(): Promise<{ id: string; token: string }> {
    const res = await h.http().post(`${API}/auth/demo`).set(fromNewClient()).expect(201);
    const token = res.body.accessToken as string;
    const me = await h
      .http()
      .get(`${API}/auth/me`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    created.push(me.body.id);
    return { id: me.body.id, token };
  }

  it('opens a signed-in account with months of history the optimizer can use', async () => {
    const { id, token } = await openDemo();

    const me = await h
      .http()
      .get(`${API}/auth/me`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.isDemo).toBe(true);

    const reviews = await h.prisma.review.count({ where: { userId: id } });
    expect(reviews).toBeGreaterThanOrEqual(MIN_REVIEWS);

    const oldest = await h.prisma.review.findFirstOrThrow({
      where: { userId: id },
      orderBy: { reviewedAt: 'asc' },
    });
    const ageDays = (Date.now() - oldest.reviewedAt.getTime()) / 86_400_000;
    expect(ageDays).toBeGreaterThan(150);

    // Every card's cached state agrees with the last review written for it.
    const cards = await h.prisma.card.findMany({
      where: { userId: id, state: { not: 'NEW' } },
      include: { reviews: { orderBy: { reviewedAt: 'desc' }, take: 1 } },
    });
    expect(cards.length).toBeGreaterThan(30);
    for (const card of cards) {
      expect(card.stability).toBeCloseTo(card.reviews[0]!.newStability, 6);
    }

    const stats = await h.prisma.userStats.findUniqueOrThrow({ where: { userId: id } });
    expect(stats.xp).toBe(reviews * 10);

    // Something is due, or the demo opens on an empty day.
    const queue = await h
      .http()
      .get(`${API}/review/queue`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(queue.body.cards.length).toBeGreaterThan(0);
  });

  it('cannot be signed in to with any password', async () => {
    const { id } = await openDemo();
    const user = await h.prisma.user.findUniqueOrThrow({ where: { id } });
    await h
      .http()
      .post(`${API}/auth/login`)
      .set(fromNewClient())
      .send({ email: user.email, password: 'correct-horse-battery' })
      .expect(401);
  });

  it('refuses AI drafts, which cost real money per call', async () => {
    const { id, token } = await openDemo();
    const deck = await h.prisma.deck.findFirstOrThrow({ where: { userId: id } });
    const res = await h
      .http()
      .post(`${API}/ai/generate`)
      .set('authorization', `Bearer ${token}`)
      .send({ deckId: deck.id, topic: 'Photosynthesis', count: 5 });
    // 403 with a provider configured; 503 when this machine has no key,
    // which is checked first. Either way nothing is generated.
    expect([403, 503]).toContain(res.status);
  });

  it('limits how many one client can open', async () => {
    const client = fromNewClient();
    for (let i = 0; i < 5; i += 1) {
      const res = await h.http().post(`${API}/auth/demo`).set(client).expect(201);
      const me = await h
        .http()
        .get(`${API}/auth/me`)
        .set('authorization', `Bearer ${res.body.accessToken}`);
      created.push(me.body.id);
    }
    await h.http().post(`${API}/auth/demo`).set(client).expect(429);
  });

  it('sweeps demo accounts older than a day, and only those', async () => {
    const { id: fresh } = await openDemo();
    const { id: stale } = await openDemo();
    await h.prisma.user.update({
      where: { id: stale },
      data: { createdAt: new Date(Date.now() - 25 * 3_600_000) },
    });

    await h.app.get(DemoService).sweep();

    expect(await h.prisma.user.findUnique({ where: { id: stale } })).toBeNull();
    expect(await h.prisma.user.findUnique({ where: { id: fresh } })).not.toBeNull();
    expect(await h.prisma.review.count({ where: { userId: stale } })).toBe(0);
  });
});
