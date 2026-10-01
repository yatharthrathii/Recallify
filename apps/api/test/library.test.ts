import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, auth, deleteUsers, registerUser, startHarness, type Harness, type TestUser } from './harness';

describe('library', () => {
  let h: Harness;
  let author: TestUser;
  let reader: TestUser;
  let other: TestUser;
  let deckId: string;
  let cardIds: string[];

  beforeAll(async () => {
    h = await startHarness();
    author = await registerUser(h, 'author');
    reader = await registerUser(h, 'reader');
    other = await registerUser(h, 'other');

    deckId = (
      await h
        .http()
        .post(`${API}/decks`)
        .set(auth(author))
        .send({ title: 'Spanish verbs', description: 'The hundred most used', color: 'moss' })
        .expect(201)
    ).body.id as string;
    await h
      .http()
      .post(`${API}/cards/bulk`)
      .set(auth(author))
      .send({
        deckId,
        cards: [
          { front: 'hablar', back: 'to speak' },
          { front: 'comer', back: 'to eat' },
          { front: 'vivir', back: 'to live' },
        ],
      })
      .expect(201);
    cardIds = (
      await h.prisma.card.findMany({ where: { deckId }, orderBy: { front: 'asc' }, select: { id: true } })
    ).map((c) => c.id);
  });

  afterAll(async () => {
    await deleteUsers(h, author, reader, other);
    await h.close();
  });

  it('is empty until something is published, and records nothing for a private deck', async () => {
    const list = await h.http().get(`${API}/library`).set(auth(reader)).expect(200);
    expect(list.body.items.filter((d: { id: string }) => d.id === deckId)).toEqual([]);
    await h.http().get(`${API}/library/${deckId}`).set(auth(reader)).expect(404);
    // The author's own private deck is visible to the author, and has no changelog.
    const mine = await h.http().get(`${API}/library/${deckId}`).set(auth(author)).expect(200);
    expect(mine.body.changes).toEqual([]);
    expect(await h.prisma.deckChange.count({ where: { deckId } })).toBe(0);
  });

  it('publishes, lists, and shows the deck with sample cards', async () => {
    const published = await h.http().post(`${API}/library/${deckId}/publish`).set(auth(author)).expect(200);
    expect(published.body.isPublic).toBe(true);
    expect(published.body.publishedAt).not.toBeNull();
    expect(published.body.subscriberCount).toBe(0);

    const list = await h.http().get(`${API}/library`).set(auth(reader)).query({ q: 'spanish' }).expect(200);
    const entry = list.body.items.find((d: { id: string }) => d.id === deckId);
    expect(entry).toMatchObject({
      title: 'Spanish verbs',
      authorName: 'author',
      cardCount: 3,
      subscriberCount: 0,
      isMine: false,
      subscribedDeckId: null,
      color: 'moss',
    });

    const detail = await h.http().get(`${API}/library/${deckId}`).set(auth(reader)).expect(200);
    expect(detail.body.sampleCards).toHaveLength(3);
    expect(detail.body.sampleCards[0]).toEqual({ front: 'hablar', back: 'to speak' });
    const asAuthor = await h.http().get(`${API}/library/${deckId}`).set(auth(author)).expect(200);
    expect(asAuthor.body.isMine).toBe(true);

    // Someone else cannot publish, unpublish or annotate it.
    await h.http().post(`${API}/library/${deckId}/publish`).set(auth(reader)).expect(404);
    await h.http().post(`${API}/library/${deckId}/unpublish`).set(auth(reader)).expect(404);
    await h.http().post(`${API}/library/${deckId}/notes`).set(auth(reader)).send({ text: 'x' }).expect(404);
  });

  it('refuses a demo account, an archived deck, and the author subscribing to their own', async () => {
    await h.http().post(`${API}/library/${deckId}/subscribe`).set(auth(author)).expect(400);

    const archived = (
      await h.http().post(`${API}/decks`).set(auth(author)).send({ title: 'Old' }).expect(201)
    ).body.id as string;
    await h.http().patch(`${API}/decks/${archived}`).set(auth(author)).send({ archived: true }).expect(200);
    await h.http().post(`${API}/library/${archived}/publish`).set(auth(author)).expect(400);

    const demo = await h.http().post(`${API}/auth/demo`).set('x-client-ip', '203.0.113.77').expect(201);
    const bearer = `Bearer ${demo.body.accessToken}`;
    const me = await h.http().get(`${API}/auth/me`).set('authorization', bearer).expect(200);
    const demoDeck = (await h.prisma.deck.findFirstOrThrow({ where: { userId: me.body.id } })).id;
    await h.http().post(`${API}/library/${demoDeck}/publish`).set('authorization', bearer).expect(403);
    await h.prisma.user.deleteMany({ where: { id: me.body.id } });
  });

  let copyId: string;

  it('subscribing makes a copy with every card new, once', async () => {
    const res = await h.http().post(`${API}/library/${deckId}/subscribe`).set(auth(reader)).expect(201);
    copyId = res.body.id;
    expect(res.body).toMatchObject({
      title: 'Spanish verbs',
      description: 'The hundred most used',
      color: 'moss',
      cardCount: 3,
      sourceDeckId: deckId,
      isPublic: false,
    });

    const cards = await h.prisma.card.findMany({ where: { deckId: copyId }, orderBy: { front: 'asc' } });
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.sourceCardId)).toEqual(cardIds);
    expect(cards.every((c) => c.state === 'NEW' && c.source === 'SUBSCRIPTION' && c.userId === reader.id)).toBe(true);

    await h.http().post(`${API}/library/${deckId}/subscribe`).set(auth(reader)).expect(409);

    const list = await h.http().get(`${API}/library`).set(auth(reader)).expect(200);
    const entry = list.body.items.find((d: { id: string }) => d.id === deckId);
    expect(entry.subscribedDeckId).toBe(copyId);
    expect(entry.subscriberCount).toBe(1);
    const authorsDeck = await h.http().get(`${API}/decks/${deckId}`).set(auth(author)).expect(200);
    expect(authorsDeck.body.subscriberCount).toBe(1);

    const status = await h.http().get(`${API}/library/subscriptions/${copyId}`).set(auth(reader)).expect(200);
    expect(status.body.pending).toEqual({ added: 0, edited: 0, removed: 0 });
    expect(status.body.source.id).toBe(deckId);
    // Your own deck that follows nothing is a 400; someone else's is a 404.
    await h.http().get(`${API}/library/subscriptions/${deckId}`).set(auth(author)).expect(400);
    await h.http().get(`${API}/library/subscriptions/${copyId}`).set(auth(other)).expect(404);
  });

  it('carries the author’s edits, additions and deletions to the copy without touching its state', async () => {
    // The reader studies one of the copies first.
    const copyCards = await h.prisma.card.findMany({ where: { deckId: copyId }, orderBy: { front: 'asc' } });
    const studied = copyCards[1]!; // hablar
    await h
      .http()
      .post(`${API}/review`)
      .set(auth(reader))
      .send({ id: randomUUID(), cardId: studied.id, rating: 3, reviewedAt: new Date().toISOString() })
      .expect(200);
    const before = await h.prisma.card.findUniqueOrThrow({ where: { id: studied.id } });
    expect(before.state).toBe('LEARNING');

    // The author edits that card, deletes another, adds one, and explains.
    const hablar = cardIds[1]!;
    const comer = cardIds[0]!;
    await h.http().patch(`${API}/cards/${hablar}`).set(auth(author)).send({ back: 'to speak, to talk' }).expect(200);
    await h.http().delete(`${API}/cards/${comer}`).set(auth(author)).expect(204);
    await h.http().post(`${API}/cards`).set(auth(author)).send({ deckId, front: 'beber', back: 'to drink' }).expect(201);
    await h
      .http()
      .post(`${API}/library/${deckId}/notes`)
      .set(auth(author))
      .send({ text: 'Added drinking, dropped eating, and fixed hablar.' })
      .expect(201);

    const status = await h.http().get(`${API}/library/subscriptions/${copyId}`).set(auth(reader)).expect(200);
    expect(status.body.pending).toEqual({ added: 1, edited: 1, removed: 1 });
    expect(status.body.changes.map((c: { kind: string; summary: string }) => [c.kind, c.summary])).toEqual([
      ['NOTE', 'Added drinking, dropped eating, and fixed hablar.'],
      ['ADDED', 'beber'],
      ['REMOVED', 'comer'],
      ['EDITED', 'hablar'],
    ]);

    const sync = await h.http().post(`${API}/library/subscriptions/${copyId}/sync`).set(auth(reader)).expect(200);
    expect(sync.body).toMatchObject({ added: 1, edited: 1, removed: 1 });

    const after = await h.prisma.card.findUniqueOrThrow({ where: { id: studied.id } });
    expect(after.back).toBe('to speak, to talk');
    // Text moved; the memory did not.
    expect(after.state).toBe(before.state);
    expect(after.stability).toBe(before.stability);
    expect(after.dueAt).toEqual(before.dueAt);
    expect(after.reps).toBe(1);
    expect(await h.prisma.review.count({ where: { cardId: studied.id } })).toBe(1);

    const eaten = await h.prisma.card.findFirst({ where: { deckId: copyId, front: 'comer' } });
    expect(eaten).not.toBeNull();
    expect(eaten!.suspendedAt).not.toBeNull();
    const drink = await h.prisma.card.findFirst({ where: { deckId: copyId, front: 'beber' } });
    expect(drink).toMatchObject({ state: 'NEW', source: 'SUBSCRIPTION', userId: reader.id });

    // Nothing pending now, and the changes the reader has already taken are behind syncedAt.
    const again = await h.http().get(`${API}/library/subscriptions/${copyId}`).set(auth(reader)).expect(200);
    expect(again.body.pending).toEqual({ added: 0, edited: 0, removed: 0 });
    expect(again.body.changes).toEqual([]);
    const second = await h.http().post(`${API}/library/subscriptions/${copyId}/sync`).set(auth(reader)).expect(200);
    expect(second.body).toMatchObject({ added: 0, edited: 0, removed: 0 });

    // The full changelog, paged.
    const log = await h.http().get(`${API}/library/${deckId}/changes`).set(auth(other)).query({ limit: 2 }).expect(200);
    expect(log.body.items).toHaveLength(2);
    expect(log.body.nextCursor).not.toBeNull();
  });

  it('an author who only studies, or saves a card unchanged, moves nothing to the copy', async () => {
    const copyCard = await h.prisma.card.findFirstOrThrow({ where: { deckId: copyId, front: 'vivir' } });
    await h.http().patch(`${API}/cards/${copyCard.id}`).set(auth(reader)).send({ back: 'my own wording' }).expect(200);
    // The author reviews their own card, and saves it with the same text.
    await h
      .http()
      .post(`${API}/review`)
      .set(auth(author))
      .send({ id: randomUUID(), cardId: cardIds[2], rating: 3, reviewedAt: new Date().toISOString() })
      .expect(200);
    await h.http().patch(`${API}/cards/${cardIds[2]}`).set(auth(author)).send({ back: 'to live' }).expect(200);
    const changes = await h.prisma.deckChange.count({ where: { deckId, kind: 'EDITED', cardId: cardIds[2]! } });
    expect(changes).toBe(0);

    const status = await h.http().get(`${API}/library/subscriptions/${copyId}`).set(auth(reader)).expect(200);
    expect(status.body.pending).toEqual({ added: 0, edited: 0, removed: 0 });
    await h.http().post(`${API}/library/subscriptions/${copyId}/sync`).set(auth(reader)).expect(200);
    expect((await h.prisma.card.findUniqueOrThrow({ where: { id: copyCard.id } })).back).toBe('my own wording');
  });

  it('a removed card, once brought back by the subscriber, stays back; a followed card cannot be deleted', async () => {
    const eaten = await h.prisma.card.findFirstOrThrow({ where: { deckId: copyId, front: 'comer' } });
    expect(eaten.sourceCardId).toBeNull();
    await h.http().post(`${API}/cards/${eaten.id}/suspend`).set(auth(reader)).send({ suspended: false }).expect(200);
    await h.http().post(`${API}/library/subscriptions/${copyId}/sync`).set(auth(reader)).expect(200);
    expect((await h.prisma.card.findUniqueOrThrow({ where: { id: eaten.id } })).suspendedAt).toBeNull();

    const followed = await h.prisma.card.findFirstOrThrow({ where: { deckId: copyId, front: 'beber' } });
    const refused = await h.http().delete(`${API}/cards/${followed.id}`).set(auth(reader)).expect(409);
    expect(refused.body.detail).toMatch(/Suspend it/);
    // Their own, detached card can go.
    await h.http().delete(`${API}/cards/${eaten.id}`).set(auth(reader)).expect(204);
  });

  it('two syncs racing add a card once, and a note is kept whole', async () => {
    await h.http().post(`${API}/cards`).set(auth(author)).send({ deckId, front: 'leer', back: 'to read' }).expect(201);
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        h.http().post(`${API}/library/subscriptions/${copyId}/sync`).set(auth(reader)),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.reduce((n, r) => n + (r.body.added as number), 0)).toBe(1);
    expect(await h.prisma.card.count({ where: { deckId: copyId, front: 'leer' } })).toBe(1);

    const text = 'Why: '.concat('a long explanation '.repeat(24)).trim().slice(0, 500);
    const note = await h.http().post(`${API}/library/${deckId}/notes`).set(auth(author)).send({ text }).expect(201);
    expect(note.body.summary).toBe(text);
    expect(note.body.summary.length).toBeGreaterThan(400);
  });

  it('a suspended card arrives suspended, and an archived deck leaves the library', async () => {
    const extra = (
      await h.http().post(`${API}/decks`).set(auth(author)).send({ title: 'Tenses' }).expect(201)
    ).body.id as string;
    const card = await h.http().post(`${API}/cards`).set(auth(author)).send({ deckId: extra, front: 'ser', back: 'to be' }).expect(201);
    await h.http().post(`${API}/cards/${card.body.id}/suspend`).set(auth(author)).send({ suspended: true }).expect(200);
    await h.http().post(`${API}/library/${extra}/publish`).set(auth(author)).expect(200);
    const copy = await h.http().post(`${API}/library/${extra}/subscribe`).set(auth(other)).expect(201);
    const copied = await h.prisma.card.findFirstOrThrow({ where: { deckId: copy.body.id } });
    expect(copied.suspendedAt).not.toBeNull();

    await h.http().patch(`${API}/decks/${extra}`).set(auth(author)).send({ archived: true }).expect(200);
    await h.http().get(`${API}/library/${extra}`).set(auth(other)).expect(404);
    const status = await h.http().get(`${API}/library/subscriptions/${copy.body.id}`).set(auth(other)).expect(200);
    expect(status.body.source).toBeNull();
    // The author's own view says it is not published any more.
    const mine = await h.http().get(`${API}/library/${extra}`).set(auth(author)).expect(200);
    expect(mine.body.publishedAt).toBeNull();
  });

  it('keeps a subscriber’s own edit until the author edits that card', async () => {
    const mine = await h.prisma.card.findFirstOrThrow({ where: { deckId: copyId, front: 'vivir' } });
    await h.http().patch(`${API}/cards/${mine.id}`).set(auth(reader)).send({ hint: 'my own hint' }).expect(200);
    const sync = await h.http().post(`${API}/library/subscriptions/${copyId}/sync`).set(auth(reader)).expect(200);
    expect(sync.body.edited).toBe(0);
    expect((await h.prisma.card.findUniqueOrThrow({ where: { id: mine.id } })).hint).toBe('my own hint');

    await h.http().patch(`${API}/cards/${cardIds[2]}`).set(auth(author)).send({ back: 'to live, to reside' }).expect(200);
    await h.http().post(`${API}/library/subscriptions/${copyId}/sync`).set(auth(reader)).expect(200);
    const taken = await h.prisma.card.findUniqueOrThrow({ where: { id: mine.id } });
    expect(taken.back).toBe('to live, to reside');
    expect(taken.hint).toBeNull();
  });

  it('unpublishing leaves the copy standing, and unsubscribing detaches it', async () => {
    await h.http().post(`${API}/library/${deckId}/unpublish`).set(auth(author)).expect(200);
    await h.http().get(`${API}/library/${deckId}`).set(auth(reader)).expect(404);
    const status = await h.http().get(`${API}/library/subscriptions/${copyId}`).set(auth(reader)).expect(200);
    expect(status.body.source).toBeNull();
    const refused = await h.http().post(`${API}/library/subscriptions/${copyId}/sync`).set(auth(reader)).expect(404);
    expect(refused.body.detail).toMatch(/stays exactly as it is/);
    expect(await h.prisma.card.count({ where: { deckId: copyId } })).toBe(4);
    // The author's later edits are not recorded while private.
    await h.http().patch(`${API}/cards/${cardIds[2]}`).set(auth(author)).send({ back: 'to live' }).expect(200);
    const changesBefore = await h.prisma.deckChange.count({ where: { deckId } });

    await h.http().post(`${API}/library/${deckId}/publish`).set(auth(author)).expect(200);
    expect(await h.prisma.deckChange.count({ where: { deckId } })).toBe(changesBefore);

    const detached = await h.http().delete(`${API}/library/subscriptions/${copyId}`).set(auth(reader)).expect(200);
    expect(detached.body.sourceDeckId).toBeNull();
    expect(detached.body.cardCount).toBe(4);
    const cards = await h.prisma.card.findMany({ where: { deckId: copyId } });
    expect(cards.every((c) => c.sourceCardId === null)).toBe(true);
    await h.http().delete(`${API}/library/subscriptions/${copyId}`).set(auth(reader)).expect(400);
    await h.http().post(`${API}/library/${copyId}/publish`).set(auth(reader)).expect(200);

    // Following again is allowed, and makes a fresh copy.
    const fresh = await h.http().post(`${API}/library/${deckId}/subscribe`).set(auth(reader)).expect(201);
    expect(fresh.body.id).not.toBe(copyId);
    expect(fresh.body.cardCount).toBe(4);
  });

  it('an author deleting the deck leaves copies detached rather than deleted', async () => {
    const copies = await h.prisma.deck.count({ where: { sourceDeckId: deckId } });
    expect(copies).toBe(1);
    await h.http().delete(`${API}/decks/${deckId}`).set(auth(author)).expect(204);
    const orphan = await h.prisma.deck.findFirst({ where: { userId: reader.id, title: 'Spanish verbs', id: { not: copyId } } });
    expect(orphan).not.toBeNull();
    expect(orphan!.sourceDeckId).toBeNull();
    expect(await h.prisma.card.count({ where: { deckId: orphan!.id } })).toBe(4);
    expect(await h.prisma.card.count({ where: { deckId: orphan!.id, sourceCardId: { not: null } } })).toBe(0);
  });
});
