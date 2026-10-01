import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIN_REVIEWS } from '@recallify/optimizer';
import { API, auth, deleteUsers, registerUser, startHarness, type Harness, type TestUser } from './harness';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * A learner who answers at 9 in the morning and 11 at night, India time, and
 * forgets more at night: enough shape for the patterns section to find.
 */
function history(cards: number, reviewsPerCard: number, now: Date) {
  const gaps = [0, 1, 3, 7, 15, 30, 45, 60, 80, 100, 120, 140, 160, 180];
  const nine = 9 * HOUR - 330 * 60_000;
  const night = 23 * HOUR - 330 * 60_000;
  return Array.from({ length: cards }, (_, c) => {
    const day0 = Math.floor(now.getTime() / DAY) * DAY - 200 * DAY + (c % 15) * DAY;
    const late = c % 2 === 1;
    return {
      front: `Card ${c}`,
      back: `Back ${c}`,
      reviews: Array.from({ length: reviewsPerCard }, (_, i) => ({
        id: randomUUID(),
        rating: late && i % 3 === 2 ? 1 : c % 7 === 0 && i === 4 ? 1 : 3,
        reviewedAt: new Date(day0 + (gaps[i] ?? 200) * DAY + (late ? night : nine)).toISOString(),
        durationMs: 6000,
      })),
    };
  });
}

describe('report and exam', () => {
  let h: Harness;
  let user: TestUser;
  let empty: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    h = await startHarness();
    user = await registerUser(h, 'reporter');
    empty = await registerUser(h, 'nothing');
    stranger = await registerUser(h, 'stranger');

    const now = new Date();
    // 40 cards, 12 reviews each: 480, above the fit threshold, in one deck,
    // and a second deck with less history for the deck comparison.
    await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ newDeck: { title: 'Heavy deck' }, cards: history(40, 12, now) })
      .expect(201);
    await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ newDeck: { title: 'Light deck' }, cards: history(10, 3, now).map((c) => ({ ...c, front: `L ${c.front}` })) })
      .expect(201);
  }, 120_000);

  afterAll(async () => {
    await deleteUsers(h, user, empty, stranger);
    await h.close();
  });

  it('has nothing to report for an account with no reviews', async () => {
    const status = await h.http().get(`${API}/report`).set(auth(empty)).expect(200);
    expect(status.body).toMatchObject({ latest: null, reviewCount: 0, nextAllowedAt: null });
    expect(status.body.minimumReviewsForFit).toBe(MIN_REVIEWS);
    await h.http().post(`${API}/report`).set(auth(empty)).send({}).expect(422);
  });

  it('fits, describes, and stores a report', async () => {
    const res = await h
      .http()
      .post(`${API}/report`)
      .set(auth(user))
      .send({ tzOffsetMinutes: 330 })
      .expect(201);
    const report = res.body;

    expect(report.reviewCount).toBe(510);
    expect(report.cardCount).toBe(50);
    expect(report.model.fitted).toBe(true);
    expect(report.model.params).toHaveLength(21);
    expect(report.model.reviewsUsed).toBe(510);
    expect(report.model.candidate.predictions).toBeGreaterThan(400);
    expect(report.model.adopted).toBe(false);
    // Not adopted and no earlier fit in use: the account runs on the defaults.
    expect(report.model.current).toEqual(report.model.baseline);

    // The curve starts at certainty and falls; a stability is the day it reaches 90%.
    expect(report.curve.source).toBe('fitted');
    expect(report.curve.yours[0]).toEqual({ day: 0, retrievability: 1 });
    expect(report.curve.yours).toHaveLength(61);
    expect(report.curve.population[60].retrievability).toBeLessThan(0.9);
    expect(report.curve.stabilityDays.population).toBeCloseTo(2.3065, 3);

    // Patterns in India time: answers at 9 am and 11 pm, nothing elsewhere.
    expect(report.patterns.tzOffsetMinutes).toBe(330);
    const busy = report.patterns.hours.filter((b: { reviews: number }) => b.reviews > 0).map((b: { hour: number }) => b.hour);
    expect(busy).toEqual([9, 23]);
    expect(report.patterns.bestHour).toBe(9);
    expect(report.patterns.worstHour).toBe(23);
    expect(report.patterns.weekdays).toHaveLength(7);

    // Leeches: the late-night cards lapse every third answer.
    expect(report.leeches.length).toBeGreaterThan(0);
    expect(report.leeches.length).toBeLessThanOrEqual(10);
    expect(report.leeches[0].lapses).toBeGreaterThanOrEqual(3);
    expect(report.leeches[0].minutesSpent).toBeGreaterThan(0);
    expect(report.leeches[0].deckTitle).toBe('Heavy deck');
    expect([1, 2, 3, 4]).toContain(report.leeches[0].lastRating);
    // A card already suspended is dealt with, so it is not listed.
    const listed = await h.prisma.card.findMany({
      where: { id: { in: report.leeches.map((l: { cardId: string }) => l.cardId) } },
      select: { suspendedAt: true },
    });
    expect(listed.every((c) => c.suspendedAt === null)).toBe(true);

    const titles = report.decks.map((d: { title: string }) => d.title);
    expect(titles).toEqual(['Heavy deck', 'Light deck']);
    expect(report.decks[0].cards).toBe(40);
    expect(report.decks[0].reviewsPerCard).toBeGreaterThan(0);

    // Every finding is a sentence with a number in it.
    expect(report.statements.length).toBeGreaterThanOrEqual(4);
    for (const s of report.statements) expect(s).toMatch(/\d/);
    expect(report.statements.join(' ')).toMatch(/remember best around 9 am/);
    expect(report.statements.join(' ')).toMatch(/forgotten 3 or more times/);

    // Stored, and read back the same.
    const again = await h.http().get(`${API}/report/${report.id}`).set(auth(user)).expect(200);
    expect(again.body).toEqual(report);
    const status = await h.http().get(`${API}/report`).set(auth(user)).expect(200);
    expect(status.body.latest.id).toBe(report.id);
    expect(status.body.nextAllowedAt).not.toBeNull();

    // Not for anyone else.
    await h.http().get(`${API}/report/${report.id}`).set(auth(stranger)).expect(404);
  });

  it('refuses a second report inside the cooldown, until the log has grown', async () => {
    const refused = await h.http().post(`${API}/report`).set(auth(user)).send({}).expect(422);
    expect(refused.body.detail).toMatch(/recently/);

    // Fifty more reviews earn another one now.
    await h
      .http()
      .post(`${API}/import`)
      .set(auth(user))
      .send({ newDeck: { title: 'More' }, cards: history(5, 10, new Date()).map((c) => ({ ...c, front: `M ${c.front}` })) })
      .expect(201);
    const status = await h.http().get(`${API}/report`).set(auth(user)).expect(200);
    expect(status.body.nextAllowedAt).toBeNull();
    const second = await h.http().post(`${API}/report`).set(auth(user)).send({}).expect(201);
    expect(second.body.reviewCount).toBe(560);
  });

  it('scores the defaults without fitting when history is short', async () => {
    const short = await registerUser(h, 'short');
    try {
      await h
        .http()
        .post(`${API}/import`)
        .set(auth(short))
        .send({ newDeck: { title: 'Few' }, cards: history(6, 5, new Date()) })
        .expect(201);
      const res = await h.http().post(`${API}/report`).set(auth(short)).send({}).expect(201);
      expect(res.body.model).toMatchObject({ fitted: false, params: null, candidate: null, adopted: false });
      expect(res.body.model.baseline.predictions).toBe(24);
      expect(res.body.curve.source).toBe('defaults');
      expect(res.body.statements.join(' ')).toMatch(new RegExp(`Below ${MIN_REVIEWS} reviews`));
      // Too few answers in any hour to name a best one.
      expect(res.body.patterns.bestHour).toBeNull();
    } finally {
      await deleteUsers(h, short);
    }
  });

  it('projects every card to an exam date, with a range and the best moves', async () => {
    const date = new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10);
    const res = await h.http().get(`${API}/stats/exam`).set(auth(user)).query({ date }).expect(200);
    const exam = res.body;

    expect(exam.date).toBe(date);
    expect(exam.daysAway).toBeGreaterThanOrEqual(29);
    expect(exam.cardsCounted).toBe(55);
    expect(exam.newCards).toBe(0);
    expect(exam.expectedRecalled).toBeGreaterThan(0);
    expect(exam.expectedRecalled).toBeLessThanOrEqual(55);
    expect(exam.low).toBeLessThanOrEqual(exam.expectedRecalled);
    expect(exam.high).toBeGreaterThanOrEqual(exam.expectedRecalled);
    expect(exam.histogram).toHaveLength(10);
    expect(exam.histogram.reduce((a: number, b: number) => a + b, 0)).toBe(55);
    // From the report made above.
    expect(exam.calibrationError).toBeGreaterThanOrEqual(0);

    expect(exam.atRisk.length).toBe(20);
    for (let i = 1; i < exam.atRisk.length; i += 1) {
      expect(exam.atRisk[i].retrievability).toBeGreaterThanOrEqual(exam.atRisk[i - 1].retrievability);
    }
    expect(exam.atRisk[0].gain).toBeUndefined();
    expect(exam.atRisk[0].deckTitle).toMatch(/deck|More/);

    expect(exam.bestMoves.length).toBe(10);
    expect(exam.bestMoves[0].gain).toBeGreaterThan(0);
    for (let i = 1; i < exam.bestMoves.length; i += 1) {
      expect(exam.bestMoves[i].gain).toBeLessThanOrEqual(exam.bestMoves[i - 1].gain);
    }

    // Narrowed to one deck.
    const deckId = exam.atRisk[0].deckId as string;
    const one = await h.http().get(`${API}/stats/exam`).set(auth(user)).query({ date, deckId }).expect(200);
    expect(one.body.cardsCounted).toBeLessThan(55);
    expect(one.body.atRisk.every((c: { deckId: string }) => c.deckId === deckId)).toBe(true);
  });

  it('refuses a past date, a bad date, and a deck that is not yours', async () => {
    await h.http().get(`${API}/stats/exam`).set(auth(user)).query({ date: '2020-01-01' }).expect(400);
    await h.http().get(`${API}/stats/exam`).set(auth(user)).query({ date: 'tomorrow' }).expect(400);
    const date = new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10);
    const deckId = (await h.prisma.deck.findFirst({ where: { userId: user.id } }))!.id;
    await h.http().get(`${API}/stats/exam`).set(auth(stranger)).query({ date, deckId }).expect(404);

    // An account with only new cards: nothing to predict, and it says so.
    const deck = (
      await h.http().post(`${API}/decks`).set(auth(empty)).send({ title: 'Fresh' }).expect(201)
    ).body.id as string;
    await h.http().post(`${API}/cards`).set(auth(empty)).send({ deckId: deck, front: 'q', back: 'a' }).expect(201);
    const none = await h.http().get(`${API}/stats/exam`).set(auth(empty)).query({ date }).expect(200);
    expect(none.body).toMatchObject({ cardsCounted: 0, newCards: 1, expectedRecalled: 0, calibrationError: null });
  });
});
