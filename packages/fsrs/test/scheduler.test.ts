/**
 * Scheduler tests — the state machine around the memory model.
 *
 * memory.test.ts covers the maths. These cover the journey a card takes: first
 * sight, the learning ladder, graduation, lapsing, and coming back.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/constants';
import { DAY_MS, newCard } from '../src/defaults';
import { explain, fuzzInterval, nextLearningStep, replay, schedule } from '../src/scheduler';
import type { Rating, ReviewLog, SchedulingCard } from '../src/types';

const T0 = new Date('2026-01-01T09:00:00Z');
const MIN = 60_000;

const at = (days: number, from: Date = T0): Date =>
  new Date(from.getTime() + days * DAY_MS);

/** Minutes between `now` and when the card comes back. */
const dueInMinutes = (card: SchedulingCard, now: Date): number =>
  Math.round((card.dueAt.getTime() - now.getTime()) / MIN);

const dueInDays = (card: SchedulingCard, now: Date): number =>
  (card.dueAt.getTime() - now.getTime()) / DAY_MS;

describe('a card seen for the first time', () => {
  const fresh = newCard(T0);

  it('starts with no memory at all', () => {
    expect(fresh.state).toBe('NEW');
    expect(fresh.stability).toBe(0);
    expect(fresh.reps).toBe(0);
    expect(fresh.lastReviewedAt).toBeNull();
  });

  it('gets no spacing bonus on the first review', () => {
    // R is 0, not 1: there is no memory to retrieve yet, and treating the card
    // as perfectly recalled would hand it a bonus it has not earned.
    const { log } = schedule(fresh, 3, T0);
    expect(log.retrievability).toBe(0);
    expect(log.elapsedDays).toBe(0);
    expect(log.prevState).toBe('NEW');
  });

  it('enters the learning ladder on Again, Hard and Good', () => {
    for (const rating of [1, 2, 3] as Rating[]) {
      expect(schedule(fresh, rating, T0).card.state).toBe('LEARNING');
    }
  });

  it('skips the ladder entirely on Easy', () => {
    const { card } = schedule(fresh, 4, T0);
    expect(card.state).toBe('REVIEW');
    expect(dueInDays(card, T0)).toBeGreaterThan(1);
  });

  it('comes back sooner the worse the answer was', () => {
    const back = ([1, 2, 3, 4] as Rating[]).map(
      (r) => schedule(fresh, r, T0).card.dueAt.getTime(),
    );
    expect(back[0]).toBeLessThanOrEqual(back[1]!);
    expect(back[1]!).toBeLessThan(back[2]!);
    expect(back[2]!).toBeLessThan(back[3]!);
  });

  it('starts more stable the better the answer was', () => {
    const s = ([1, 2, 3, 4] as Rating[]).map((r) => schedule(fresh, r, T0).card.stability);
    expect(s[0]).toBeLessThan(s[1]!);
    expect(s[1]!).toBeLessThan(s[2]!);
    expect(s[2]!).toBeLessThan(s[3]!);
  });

  it('counts the review', () => {
    expect(schedule(fresh, 3, T0).card.reps).toBe(1);
    expect(schedule(fresh, 3, T0).card.lapses).toBe(0);
  });
});

describe('the learning ladder', () => {
  // Default steps are 1 minute, then 10 minutes.
  const steps = DEFAULT_CONFIG.learningSteps;

  it('has the shape the tests below assume', () => {
    expect([...steps]).toEqual([1, 10]);
  });

  it('Good walks up one rung at a time, then graduates', () => {
    const t1 = T0;
    const first = schedule(newCard(T0), 3, t1).card;
    expect(first.state).toBe('LEARNING');
    expect(first.learningStep).toBe(1);
    expect(dueInMinutes(first, t1)).toBe(10);

    const t2 = new Date(t1.getTime() + 10 * MIN);
    const second = schedule(first, 3, t2).card;
    expect(second.state).toBe('REVIEW');
    expect(dueInDays(second, t2)).toBeGreaterThanOrEqual(1);
  });

  it('Again knocks the card back to the bottom rung', () => {
    const t1 = T0;
    const climbed = schedule(newCard(T0), 3, t1).card;
    expect(climbed.learningStep).toBe(1);

    const t2 = new Date(t1.getTime() + 10 * MIN);
    const fell = schedule(climbed, 1, t2).card;
    expect(fell.state).toBe('LEARNING');
    expect(fell.learningStep).toBe(0);
    expect(dueInMinutes(fell, t2)).toBe(1);
  });

  it('Hard holds the card on the rung it is already on', () => {
    const t1 = T0;
    const first = schedule(newCard(T0), 3, t1).card;
    const t2 = new Date(t1.getTime() + 10 * MIN);
    const held = schedule(first, 2, t2).card;

    expect(held.state).toBe('LEARNING');
    expect(held.learningStep).toBe(1);
  });

  it('Easy graduates from any rung', () => {
    const first = schedule(newCard(T0), 1, T0).card;
    expect(first.learningStep).toBe(0);

    const out = schedule(first, 4, new Date(T0.getTime() + MIN)).card;
    expect(out.state).toBe('REVIEW');
  });

  it('a rating that walks past the last rung graduates', () => {
    expect(nextLearningStep(0, 3, 2)).toBe(1);
    expect(nextLearningStep(1, 3, 2)).toBe(-1); // -1 means graduate
    expect(nextLearningStep(1, 1, 2)).toBe(0); // Again -> bottom
    expect(nextLearningStep(1, 2, 2)).toBe(1); // Hard  -> stay
    expect(nextLearningStep(0, 4, 2)).toBe(-1); // Easy  -> out
  });

  it('graduates immediately when there are no steps configured', () => {
    const noSteps = { ...DEFAULT_CONFIG, learningSteps: [] as readonly number[] };
    expect(schedule(newCard(T0), 3, T0, noSteps).card.state).toBe('REVIEW');
  });
});

describe('a card in review', () => {
  /** A card that has graduated and settled. */
  const graduated = (): SchedulingCard => {
    let c = schedule(newCard(T0), 4, T0).card;
    c = schedule(c, 3, at(10)).card;
    return c;
  };

  it('is in REVIEW with real stability', () => {
    const c = graduated();
    expect(c.state).toBe('REVIEW');
    expect(c.stability).toBeGreaterThan(1);
  });

  it('grows its interval when recalled', () => {
    const before = graduated();
    const after = schedule(before, 3, at(30)).card;
    expect(after.stability).toBeGreaterThan(before.stability);
    expect(after.state).toBe('REVIEW');
  });

  it('falls into relearning on Again, and counts the lapse', () => {
    const before = graduated();
    const after = schedule(before, 1, at(30)).card;

    expect(after.state).toBe('RELEARNING');
    expect(after.lapses).toBe(before.lapses + 1);
    expect(after.stability).toBeLessThan(before.stability);
    expect(dueInMinutes(after, at(30))).toBe(10); // first relearning step
  });

  it('climbs back out of relearning on Good', () => {
    const lapsed = schedule(graduated(), 1, at(30)).card;
    const recovered = schedule(lapsed, 3, at(30.01)).card;

    expect(recovered.state).toBe('REVIEW');
    expect(recovered.lapses).toBe(1); // recovering does not undo the lapse
  });

  it('does not count a second lapse while already relearning', () => {
    const lapsed = schedule(graduated(), 1, at(30)).card;
    const again = schedule(lapsed, 1, at(30.01)).card;

    expect(again.lapses).toBe(1);
    expect(again.state).toBe('RELEARNING');
  });

  it('rewards a late successful review more than an early one', () => {
    const card = graduated();
    const early = schedule(card, 3, at(12)).card;
    const late = schedule(card, 3, at(60)).card;
    expect(late.stability).toBeGreaterThan(early.stability);
  });
});

describe('interval fuzz', () => {
  it('does nothing at the midpoint, so scheduling stays reproducible', () => {
    expect(fuzzInterval(30, 0.5)).toBe(30);
  });

  it('spreads due dates either side of the true interval', () => {
    expect(fuzzInterval(100, 0)).toBeLessThan(100);
    expect(fuzzInterval(100, 1)).toBeGreaterThan(100);
  });

  it('leaves short intervals alone — a day either way is not worth jitter', () => {
    expect(fuzzInterval(1, 0)).toBe(1);
    expect(fuzzInterval(2, 1)).toBe(2);
  });

  it('stays inside the configured band', () => {
    const f = DEFAULT_CONFIG.fuzzFactor;
    for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
      const out = fuzzInterval(100, random);
      expect(out).toBeGreaterThanOrEqual(100 * (1 - f));
      expect(out).toBeLessThanOrEqual(100 * (1 + f));
    }
  });
});

describe('why this card', () => {
  it('explains a card that has just been reviewed', () => {
    const card = schedule(newCard(T0), 3, T0).card;
    const e = explain(card, T0);

    expect(e.elapsedDays).toBe(0);
    expect(e.retrievability).toBeCloseTo(1, 6);
    expect(e.stability).toBe(card.stability);
    expect(e.difficulty).toBe(card.difficulty);
  });

  it('shows retrievability decaying as the card sits unseen', () => {
    const card = schedule(newCard(T0), 4, T0).card;
    const soon = explain(card, at(1));
    const later = explain(card, at(60));

    expect(soon.retrievability).toBeGreaterThan(later.retrievability);
    expect(later.elapsedDays).toBe(60);
  });

  it('predicts the moment recall drops to the target retention', () => {
    const card = schedule(newCard(T0), 4, T0).card;
    const e = explain(card, T0);
    // The predicted date is exactly where the curve crosses desiredRetention,
    // which is the same number that became the due date.
    expect(e.predictedForgetAt.getTime()).toBeGreaterThan(T0.getTime());
    expect(e.intervalDays).toBeCloseTo(card.stability, 6);
  });

  it('reports zero recall for a card nobody has seen', () => {
    expect(explain(newCard(T0), T0).retrievability).toBe(0);
  });
});

describe('replaying the log', () => {
  /** Drive a card through a mixed history and keep every log row. */
  const history = (): { logs: ReviewLog[]; final: SchedulingCard } => {
    const ratings: Rating[] = [3, 3, 4, 1, 3, 2, 3, 4];
    let card = newCard(T0);
    const logs: ReviewLog[] = [];
    let day = 0;

    for (const rating of ratings) {
      day += 3;
      const out = schedule(card, rating, at(day));
      logs.push(out.log);
      card = out.card;
    }
    return { logs, final: card };
  };

  it('rebuilds exactly the state the card ended up in', () => {
    const { logs, final } = history();
    const rebuilt = replay(logs);

    expect(rebuilt.state).toBe(final.state);
    expect(rebuilt.stability).toBeCloseTo(final.stability, 10);
    expect(rebuilt.difficulty).toBeCloseTo(final.difficulty, 10);
    expect(rebuilt.reps).toBe(final.reps);
    expect(rebuilt.lapses).toBe(final.lapses);
    expect(rebuilt.dueAt.getTime()).toBe(final.dueAt.getTime());
  });

  it('is order-independent — an offline batch can arrive shuffled', () => {
    const { logs } = history();
    const shuffled = [logs[3]!, logs[0]!, logs[7]!, logs[1]!, logs[5]!, logs[2]!, logs[6]!, logs[4]!];

    expect(replay(shuffled).stability).toBeCloseTo(replay(logs).stability, 10);
    expect(replay(shuffled).reps).toBe(replay(logs).reps);
  });

  it('gives a fresh card back for an empty log', () => {
    const empty = replay([]);
    expect(empty.state).toBe('NEW');
    expect(empty.reps).toBe(0);
    expect(empty.stability).toBe(0);
  });

  it('is deterministic — replaying twice gives the same answer', () => {
    const { logs } = history();
    expect(replay(logs)).toEqual(replay(logs));
  });
});
