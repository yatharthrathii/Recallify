import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, auth, deleteUsers, registerUser, startHarness, type Harness, type TestUser } from './harness';

describe('decks and cards', () => {
  let h: Harness;
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    h = await startHarness();
    owner = await registerUser(h, 'owner');
    stranger = await registerUser(h, 'stranger');
  });

  afterAll(async () => {
    await deleteUsers(h, owner, stranger);
    await h.close();
  });

  async function makeDeck(user: TestUser, title = 'Neuroscience'): Promise<string> {
    const res = await h
      .http()
      .post(`${API}/decks`)
      .set(auth(user))
      .send({ title, color: 'teal' })
      .expect(201);
    return res.body.id as string;
  }

  it('creates a deck with zero counts', async () => {
    const res = await h
      .http()
      .post(`${API}/decks`)
      .set(auth(owner))
      .send({ title: 'Anatomy', description: 'Bones', color: 'clay' })
      .expect(201);

    expect(res.body).toMatchObject({
      title: 'Anatomy',
      description: 'Bones',
      color: 'clay',
      cardCount: 0,
      dueCount: 0,
      archivedAt: null,
    });
  });

  it("never returns another user's deck", async () => {
    const deckId = await makeDeck(owner);

    await h.http().get(`${API}/decks/${deckId}`).set(auth(stranger)).expect(404);
    await h.http().patch(`${API}/decks/${deckId}`).set(auth(stranger)).send({ title: 'x' }).expect(404);
    await h.http().delete(`${API}/decks/${deckId}`).set(auth(stranger)).expect(404);
    await h.http().get(`${API}/decks/${deckId}/stats`).set(auth(stranger)).expect(404);

    // And it is still exactly as the owner left it.
    const after = await h.http().get(`${API}/decks/${deckId}`).set(auth(owner)).expect(200);
    expect(after.body.title).toBe('Neuroscience');
  });

  it('refuses to put a card in a deck the user does not own', async () => {
    const deckId = await makeDeck(owner);

    await h
      .http()
      .post(`${API}/cards`)
      .set(auth(stranger))
      .send({ deckId, front: 'sneaky', back: 'card' })
      .expect(404);

    await h
      .http()
      .post(`${API}/cards/bulk`)
      .set(auth(stranger))
      .send({ deckId, cards: [{ front: 'sneaky', back: 'card' }] })
      .expect(404);

    expect(await h.prisma.card.count({ where: { deckId } })).toBe(0);
  });

  it('archives without deleting, and hides from the default listing', async () => {
    const deckId = await makeDeck(owner, 'Retired');

    await h.http().patch(`${API}/decks/${deckId}`).set(auth(owner)).send({ archived: true }).expect(200);

    const hidden = await h.http().get(`${API}/decks`).set(auth(owner)).expect(200);
    expect(hidden.body.items.map((d: { id: string }) => d.id)).not.toContain(deckId);

    const shown = await h
      .http()
      .get(`${API}/decks?includeArchived=true`)
      .set(auth(owner))
      .expect(200);
    expect(shown.body.items.map((d: { id: string }) => d.id)).toContain(deckId);

    // The row is still there, which is the whole point of archiving.
    expect(await h.prisma.deck.count({ where: { id: deckId } })).toBe(1);
  });

  it('reads ?includeArchived=false as false', async () => {
    const deckId = await makeDeck(owner, 'Flag check');
    await h.http().patch(`${API}/decks/${deckId}`).set(auth(owner)).send({ archived: true }).expect(200);

    // z.coerce.boolean() would read the string "false" as true and show it.
    const res = await h
      .http()
      .get(`${API}/decks?includeArchived=false`)
      .set(auth(owner))
      .expect(200);

    expect(res.body.items.map((d: { id: string }) => d.id)).not.toContain(deckId);
  });

  it('creates cards in bulk and counts them on the deck', async () => {
    const deckId = await makeDeck(owner, 'Bulk');

    const res = await h
      .http()
      .post(`${API}/cards/bulk`)
      .set(auth(owner))
      .send({
        deckId,
        source: 'IMPORT',
        cards: Array.from({ length: 25 }, (_, i) => ({ front: `q${i}`, back: `a${i}` })),
      })
      .expect(201);

    expect(res.body).toEqual({ deckId, created: 25 });

    const deck = await h.http().get(`${API}/decks/${deckId}`).set(auth(owner)).expect(200);
    expect(deck.body.cardCount).toBe(25);
    // New cards are due immediately, which is what makes them studiable.
    expect(deck.body.dueCount).toBe(25);
  });

  it('denormalises userId onto every card so the due query can filter on it', async () => {
    const deckId = await makeDeck(owner, 'Denormalised');
    await h
      .http()
      .post(`${API}/cards`)
      .set(auth(owner))
      .send({ deckId, front: 'q', back: 'a' })
      .expect(201);

    const cards = await h.prisma.card.findMany({ where: { deckId }, select: { userId: true } });
    expect(cards.every((c) => c.userId === owner.id)).toBe(true);
  });

  it('edits card text without touching its scheduling state', async () => {
    const deckId = await makeDeck(owner, 'Typo');
    const created = await h
      .http()
      .post(`${API}/cards`)
      .set(auth(owner))
      .send({ deckId, front: 'teh capital of France', back: 'Paris' })
      .expect(201);

    const cardId = created.body.id as string;

    // Give it some state to preserve.
    await h.prisma.card.update({
      where: { id: cardId },
      data: { state: 'REVIEW', stability: 37.5, difficulty: 6.1, reps: 4, lapses: 1 },
    });

    const edited = await h
      .http()
      .patch(`${API}/cards/${cardId}`)
      .set(auth(owner))
      .send({ front: 'the capital of France' })
      .expect(200);

    expect(edited.body.front).toBe('the capital of France');
    expect(edited.body).toMatchObject({
      state: 'REVIEW',
      stability: 37.5,
      difficulty: 6.1,
      reps: 4,
      lapses: 1,
    });
  });

  it('suspends and restores a card without losing its state', async () => {
    const deckId = await makeDeck(owner, 'Suspend');
    const created = await h
      .http()
      .post(`${API}/cards`)
      .set(auth(owner))
      .send({ deckId, front: 'q', back: 'a' })
      .expect(201);
    const cardId = created.body.id as string;

    const suspended = await h
      .http()
      .post(`${API}/cards/${cardId}/suspend`)
      .set(auth(owner))
      .send({ suspended: true })
      .expect(200);
    expect(suspended.body.suspendedAt).not.toBeNull();

    // Out of the deck's due count while suspended.
    const deck = await h.http().get(`${API}/decks/${deckId}`).set(auth(owner)).expect(200);
    expect(deck.body.dueCount).toBe(0);

    const restored = await h
      .http()
      .post(`${API}/cards/${cardId}/suspend`)
      .set(auth(owner))
      .send({ suspended: false })
      .expect(200);
    expect(restored.body.suspendedAt).toBeNull();
  });

  it('paginates by cursor', async () => {
    const solo = await registerUser(h, 'pager');
    try {
      const deckId = (
        await h.http().post(`${API}/decks`).set(auth(solo)).send({ title: 'Paged' }).expect(201)
      ).body.id as string;

      await h
        .http()
        .post(`${API}/cards/bulk`)
        .set(auth(solo))
        .send({ deckId, cards: Array.from({ length: 12 }, (_, i) => ({ front: `q${i}`, back: `a${i}` })) })
        .expect(201);

      const first = await h.http().get(`${API}/cards?limit=5`).set(auth(solo)).expect(200);
      expect(first.body.items).toHaveLength(5);
      expect(first.body.nextCursor).toBeTruthy();

      const second = await h
        .http()
        .get(`${API}/cards?limit=5&cursor=${first.body.nextCursor}`)
        .set(auth(solo))
        .expect(200);
      expect(second.body.items).toHaveLength(5);

      // No overlap: the cursor row itself is skipped, not returned twice.
      const firstIds = first.body.items.map((c: { id: string }) => c.id);
      const secondIds = second.body.items.map((c: { id: string }) => c.id);
      expect(firstIds.filter((id: string) => secondIds.includes(id))).toHaveLength(0);

      const last = await h
        .http()
        .get(`${API}/cards?limit=5&cursor=${second.body.nextCursor}`)
        .set(auth(solo))
        .expect(200);
      expect(last.body.items).toHaveLength(2);
      expect(last.body.nextCursor).toBeNull();
    } finally {
      await deleteUsers(h, solo);
    }
  });

  it('reports deck stats over the cards that have actually been seen', async () => {
    const deckId = await makeDeck(owner, 'Stats');
    await h
      .http()
      .post(`${API}/cards/bulk`)
      .set(auth(owner))
      .send({ deckId, cards: Array.from({ length: 4 }, (_, i) => ({ front: `q${i}`, back: `a${i}` })) })
      .expect(201);

    const res = await h.http().get(`${API}/decks/${deckId}/stats`).set(auth(owner)).expect(200);

    expect(res.body.total).toBe(4);
    expect(res.body.newCards).toBe(4);
    expect(res.body.forecast).toHaveLength(30);
    // Nothing has been reviewed, so there is no memory to average. Reporting a
    // number here would be inventing one.
    expect(res.body.averageRetrievability).toBe(0);
  });
});
