import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AiService } from '../src/ai/ai.service';
import {
  type AiProvider,
  AiUnavailableError,
  type Completion,
  type CompletionRequest,
} from '../src/ai/provider';
import {
  API,
  auth,
  deleteUsers,
  registerUser,
  startHarness,
  type Harness,
  type TestUser,
} from './harness';

/**
 * Plays back scripted model replies. A reply is either the text the model
 * "said", or an error it threw. When the script runs out it keeps answering
 * with well-formed cards, as many as the prompt asked for.
 */
class ScriptedProvider implements AiProvider {
  configured = true;
  calls: CompletionRequest[] = [];
  private script: (string | Error)[] = [];

  play(...replies: (string | Error)[]): void {
    this.script = replies;
  }

  reset(): void {
    this.calls = [];
    this.script = [];
    this.configured = true;
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    this.calls.push(request);
    const next = this.script.shift();
    if (next instanceof Error) throw next;

    const asked = Number(
      /exactly (\d+) cards/.exec(request.messages[0]?.content ?? '')?.[1] ?? 10,
    );
    const text =
      next ??
      JSON.stringify({
        cards: Array.from({ length: asked }, (_, i) => ({
          front: `Generated question ${i}?`,
          back: `Generated answer ${i}`,
        })),
      });
    return { text, model: 'scripted-model', promptTokens: 120, outputTokens: 60 };
  }
}

const reply = (n: number) =>
  JSON.stringify({
    cards: Array.from({ length: n }, (_, i) => ({
      front: `Scripted card ${i}?`,
      back: `A${i}`,
    })),
  });

describe('ai', () => {
  const model = new ScriptedProvider();
  let h: Harness;
  const users: TestUser[] = [];

  beforeAll(async () => {
    h = await startHarness({ aiProvider: model });
  });

  beforeEach(() => model.reset());

  afterAll(async () => {
    await deleteUsers(h, ...users);
    await h.close();
  });

  async function freshUserWithDeck(
    label: string,
  ): Promise<{ user: TestUser; deckId: string }> {
    const user = await registerUser(h, label);
    users.push(user);
    const deck = await h
      .http()
      .post(`${API}/decks`)
      .set(auth(user))
      .send({ title: 'AI deck' })
      .expect(201);
    return { user, deckId: deck.body.id as string };
  }

  const generate = (user: TestUser, body: Record<string, unknown>) =>
    h.http().post(`${API}/ai/generate`).set(auth(user)).send(body);

  const charged = async (user: TestUser) =>
    (
      await h.prisma.aiUsage.aggregate({
        where: { userId: user.id },
        _sum: { cardsCreated: true },
      })
    )._sum.cardsCreated ?? 0;

  it('returns drafts and saves nothing', async () => {
    const { user, deckId } = await freshUserWithDeck('drafts');

    const res = await generate(user, { deckId, topic: 'Enzymes', count: 10 }).expect(200);

    expect(res.body.drafts).toHaveLength(10);
    expect(res.body.model).toBe('scripted-model');
    expect(res.body.usage).toMatchObject({
      usedToday: 10,
      dailyLimit: 20,
      remaining: 10,
    });

    // The model never writes to the database. The user decides what is kept.
    expect(await h.prisma.card.count({ where: { deckId } })).toBe(0);
  });

  it('saves accepted drafts through the ordinary bulk path, marked as AI', async () => {
    const { user, deckId } = await freshUserWithDeck('accept');
    const res = await generate(user, { deckId, topic: 'Enzymes', count: 4 }).expect(200);

    await h
      .http()
      .post(`${API}/cards/bulk`)
      .set(auth(user))
      .send({ deckId, source: 'AI', cards: res.body.drafts.slice(0, 3) })
      .expect(201);

    const saved = await h.prisma.card.findMany({
      where: { deckId },
      select: { source: true },
    });
    expect(saved).toHaveLength(3);
    expect(saved.every((c) => c.source === 'AI')).toBe(true);
  });

  it("spends nothing on someone else's deck", async () => {
    const { deckId } = await freshUserWithDeck('owner');
    const { user: stranger } = await freshUserWithDeck('stranger');

    await generate(stranger, { deckId, topic: 'Enzymes' }).expect(404);

    expect(model.calls).toHaveLength(0);
    expect(await charged(stranger)).toBe(0);
  });

  it('hands out what is left rather than refusing, then stops at the limit', async () => {
    const { user, deckId } = await freshUserWithDeck('clamp');
    await h.prisma.user.update({ where: { id: user.id }, data: { aiDailyLimit: 15 } });

    await generate(user, { deckId, topic: 'First', count: 10 }).expect(200);

    // Five left, ten asked for: five come back, and the prompt asked for five.
    const second = await generate(user, { deckId, topic: 'Second', count: 10 }).expect(
      200,
    );
    expect(second.body.drafts).toHaveLength(5);
    expect(model.calls.at(-1)?.messages[0]?.content).toContain('exactly 5 cards');
    expect(second.body.usage.remaining).toBe(0);

    const third = await generate(user, { deckId, topic: 'Third', count: 1 }).expect(429);
    expect(third.body.detail).toContain('allowance');
  });

  it('charges for what came back, not for what was asked', async () => {
    const { user, deckId } = await freshUserWithDeck('short-reply');
    model.play(reply(6));

    const res = await generate(user, { deckId, topic: 'Enzymes', count: 10 }).expect(200);

    expect(res.body.drafts).toHaveLength(6);
    expect(await charged(user)).toBe(6);
  });

  it('retries once after an unusable reply', async () => {
    const { user, deckId } = await freshUserWithDeck('retry');
    model.play('this is not json at all', reply(10));

    const res = await generate(user, { deckId, topic: 'Enzymes', count: 10 }).expect(200);

    expect(res.body.drafts).toHaveLength(10);
    expect(model.calls).toHaveLength(2);
    // The retry carries the extra instruction; the first call did not.
    expect(model.calls[1]!.messages.length).toBe(model.calls[0]!.messages.length + 1);
  });

  it('gives up after two unusable replies and charges nothing', async () => {
    const { user, deckId } = await freshUserWithDeck('garbage');
    model.play('nope', 'still nope');

    const res = await generate(user, { deckId, topic: 'Enzymes' }).expect(502);

    expect(res.body.detail).toContain('Nothing was charged');
    expect(model.calls).toHaveLength(2);
    expect(await charged(user)).toBe(0);
  });

  it('refunds a request the model declined', async () => {
    const { user, deckId } = await freshUserWithDeck('declined');
    model.play('{"cards":[]}', '{"cards":[]}');

    await generate(user, { deckId, topic: 'Something unsuitable' }).expect(422);

    expect(await charged(user)).toBe(0);
  });

  it('refunds when every model is busy', async () => {
    const { user, deckId } = await freshUserWithDeck('busy');
    model.play(new AiUnavailableError('busy', 30));

    const res = await generate(user, { deckId, topic: 'Enzymes' }).expect(503);

    expect(res.body.detail).toContain('30 seconds');
    expect(await charged(user)).toBe(0);
  });

  it('counts failed attempts towards the per-minute limit', async () => {
    const { user, deckId } = await freshUserWithDeck('per-minute');
    await h.prisma.user.update({ where: { id: user.id }, data: { aiDailyLimit: 1000 } });

    // Three failures in a row cost no allowance...
    model.play(
      new AiUnavailableError('busy'),
      new AiUnavailableError('busy'),
      new AiUnavailableError('busy'),
    );
    for (let i = 0; i < 3; i += 1) {
      await generate(user, { deckId, topic: 'Enzymes', count: 1 }).expect(503);
    }

    // ...but they are still attempts. Refunding them from the rate limit too
    // would let a request that always fails hammer the provider for free.
    const fourth = await generate(user, { deckId, topic: 'Enzymes', count: 1 }).expect(
      429,
    );
    expect(fourth.body.detail).toContain('a minute');
    expect(await charged(user)).toBe(0);
  });

  it('never lets requests arriving together spend the same allowance', async () => {
    const { user, deckId } = await freshUserWithDeck('race');
    const service = h.app.get(AiService);

    // Warm the pool first. Prisma opens connections lazily, and on a hosted
    // database a new one takes over a second -- so against a cold pool the
    // second reservation cannot start until the first has committed, and the
    // race never happens. A production pool is warm. Without this line the
    // test passed with the lock deleted.
    await Promise.all(Array.from({ length: 8 }, () => h.prisma.$executeRaw`SELECT pg_sleep(0.3)`));

    // Called on the service directly rather than over HTTP, and against a
    // warm pool (below). Three earlier versions of this test -- two requests
    // and then six through supertest, then six on the service against a cold
    // pool -- all passed with the row lock deleted, which means they proved
    // nothing. This one was checked the same
    // way before it was trusted: with the lock removed, all six requests got
    // through and 120 cards were charged against a 20-card limit, three runs
    // out of three.
    const outcomes = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        service.generate(user.id, { deckId, topic: `Race ${i}`, count: 20 }),
      ),
    );

    const succeeded = outcomes.filter((o) => o.status === 'fulfilled');
    const refused = outcomes.filter(
      (o) => o.status === 'rejected' && (o.reason as { getStatus?: () => number }).getStatus?.() === 429,
    );

    // Checking first and charging afterwards would let several see twenty left.
    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(5);
    expect(await charged(user)).toBe(20);
  });

  it('answers 503 when the server has no key, without touching the allowance', async () => {
    const { user, deckId } = await freshUserWithDeck('no-key');
    model.configured = false;

    await generate(user, { deckId, topic: 'Enzymes' }).expect(503);

    expect(await h.prisma.aiUsage.count({ where: { userId: user.id } })).toBe(0);
  });

  it('reports usage with a reset at the next UTC midnight', async () => {
    const { user } = await freshUserWithDeck('usage');

    const res = await h.http().get(`${API}/ai/usage`).set(auth(user)).expect(200);

    expect(res.body).toMatchObject({ usedToday: 0, dailyLimit: 20, remaining: 20 });
    const reset = new Date(res.body.resetsAt);
    expect(reset.getUTCHours()).toBe(0);
    expect(reset.getUTCMinutes()).toBe(0);
    expect(reset.getTime()).toBeGreaterThan(Date.now());
    expect(reset.getTime() - Date.now()).toBeLessThanOrEqual(86_400_000);
  });

  it('records a report on a draft that was never saved', async () => {
    const { user } = await freshUserWithDeck('report');

    await h
      .http()
      .post(`${API}/ai/report`)
      .set(auth(user))
      .send({
        front: 'Which article lists the Fundamental Rights?',
        back: 'Article 12',
        reason: 'incorrect',
        note: 'Article 12 defines the State; the rights are Part III.',
        model: 'openai/gpt-oss-120b',
      })
      .expect(204);

    const stored = await h.prisma.aiReport.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ reason: 'incorrect', back: 'Article 12' });
  });

  it('rejects a report reason it does not know', async () => {
    const { user } = await freshUserWithDeck('bad-report');

    await h
      .http()
      .post(`${API}/ai/report`)
      .set(auth(user))
      .send({ front: 'Q', back: 'A', reason: 'boring' })
      .expect(400);
  });

  it('requires a signed-in user for every AI route', async () => {
    await h.http().post(`${API}/ai/generate`).send({}).expect(401);
    await h.http().get(`${API}/ai/usage`).expect(401);
    await h.http().post(`${API}/ai/report`).send({}).expect(401);
  });
});
