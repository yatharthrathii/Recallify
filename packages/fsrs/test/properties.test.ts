/**
 * Property-based tests: the invariants of the memory model.
 *
 * These are the specification. A differential test proves we match one
 * particular implementation; these prove the model behaves like memory does,
 * and they would still be meaningful if the reference disappeared or the
 * parameters were replaced by a user's optimised set.
 *
 * fast-check generates thousands of cases per property and shrinks any failure
 * to its smallest form.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, D_MAX, D_MIN, S_MAX, S_MIN } from '../src/constants';
import { addDays } from '../src/defaults';
import { schedule } from '../src/scheduler';
import {
  initialDifficulty,
  initialStability,
  intervalFromRetention,
  nextDifficulty,
  nextForgetStability,
  nextRecallStability,
  nextShortTermStability,
  retrievability,
} from '../src/memory';
import type { CardState, Rating, SchedulingCard } from '../src/types';

const P = DEFAULT_PARAMS;
const RATINGS: readonly Rating[] = [1, 2, 3, 4];

const arbRating = fc.constantFrom<Rating>(...RATINGS);
const arbStability = fc.double({ min: 0.01, max: 3650, noNaN: true, noDefaultInfinity: true });
const arbDifficulty = fc.double({ min: 1, max: 10, noNaN: true, noDefaultInfinity: true });
const arbR = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
const arbElapsed = fc.double({ min: 0, max: 3650, noNaN: true, noDefaultInfinity: true });

describe('forgetting curve', () => {
  it('always returns a probability', () => {
    fc.assert(
      fc.property(arbElapsed, arbStability, (t, s) => {
        const r = retrievability(P, t, s);
        return Number.isFinite(r) && r >= 0 && r <= 1;
      }),
      { numRuns: 2000 },
    );
  });

  it('is exactly 100% at the moment of review', () => {
    fc.assert(
      fc.property(arbStability, (s) => Math.abs(retrievability(P, 0, s) - 1) < 1e-12),
      { numRuns: 500 },
    );
  });

  it('is exactly 90% after S days — the definition of stability', () => {
    fc.assert(
      fc.property(arbStability, (s) => Math.abs(retrievability(P, s, s) - 0.9) < 1e-9),
      { numRuns: 1000 },
    );
  });

  it('never increases as time passes', () => {
    fc.assert(
      fc.property(arbStability, arbElapsed, arbElapsed, (s, a, b) => {
        const [earlier, later] = a <= b ? [a, b] : [b, a];
        return retrievability(P, earlier, s) >= retrievability(P, later, s) - 1e-12;
      }),
      { numRuns: 2000 },
    );
  });

  it('is higher for a more stable memory at the same moment', () => {
    fc.assert(
      fc.property(arbElapsed, arbStability, arbStability, (t, a, b) => {
        const [weak, strong] = a <= b ? [a, b] : [b, a];
        return retrievability(P, t, weak) <= retrievability(P, t, strong) + 1e-12;
      }),
      { numRuns: 2000 },
    );
  });
});

describe('interval from desired retention', () => {
  it('round-trips through the curve', () => {
    fc.assert(
      fc.property(
        arbStability,
        fc.double({ min: 0.7, max: 0.98, noNaN: true, noDefaultInfinity: true }),
        (s, target) => {
          const days = intervalFromRetention(P, s, target);
          return Math.abs(retrievability(P, days, s) - target) < 1e-9;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('demanding higher retention always shortens the interval', () => {
    fc.assert(
      fc.property(arbStability, (s) => {
        const relaxed = intervalFromRetention(P, s, 0.8);
        const strict = intervalFromRetention(P, s, 0.95);
        return strict < relaxed;
      }),
      { numRuns: 1000 },
    );
  });

  it('scales linearly with stability', () => {
    fc.assert(
      fc.property(arbStability, (s) => {
        const single = intervalFromRetention(P, s, 0.9);
        const double = intervalFromRetention(P, s * 2, 0.9);
        return Math.abs(double - single * 2) < 1e-6 * Math.max(1, single);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('difficulty', () => {
  it('stays within [1, 10] after any update', () => {
    fc.assert(
      fc.property(arbDifficulty, arbRating, (d, g) => {
        const next = nextDifficulty(P, d, g);
        return Number.isFinite(next) && next >= D_MIN && next <= D_MAX;
      }),
      { numRuns: 3000 },
    );
  });

  it('rises on Again and falls on Easy', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 2, max: 9, noNaN: true, noDefaultInfinity: true }),
        (d) => nextDifficulty(P, d, 1) > d && nextDifficulty(P, d, 4) < d,
      ),
      { numRuns: 1000 },
    );
  });

  it('is monotonic in the rating: a better answer never makes a card harder', () => {
    fc.assert(
      fc.property(arbDifficulty, (d) => {
        const byRating = RATINGS.map((g) => nextDifficulty(P, d, g));
        return byRating.every((v, i) => i === 0 || v <= byRating[i - 1]! + 1e-12);
      }),
      { numRuns: 2000 },
    );
  });

  it('starts easier the better the first answer was', () => {
    const byRating = RATINGS.map((g) => initialDifficulty(P, g));
    expect(byRating.every((v, i) => i === 0 || v < byRating[i - 1]!)).toBe(true);
  });
});

describe('stability', () => {
  it('is always finite and within model bounds', () => {
    fc.assert(
      fc.property(arbDifficulty, arbStability, arbR, arbRating, (d, s, r, g) => {
        const values = [
          nextRecallStability(P, d, s, r, g),
          nextForgetStability(P, d, s, r),
          nextShortTermStability(P, s, g),
          initialStability(P, g),
        ];
        return values.every((v) => Number.isFinite(v) && v >= S_MIN && v <= S_MAX);
      }),
      { numRuns: 3000 },
    );
  });

  it('never decreases on a successful recall', () => {
    fc.assert(
      fc.property(arbDifficulty, arbStability, arbR, fc.constantFrom<Rating>(2, 3, 4), (d, s, r, g) =>
        nextRecallStability(P, d, s, r, g) >= s - 1e-9,
      ),
      { numRuns: 3000 },
    );
  });

  it('rewards a better answer with at least as much stability', () => {
    fc.assert(
      fc.property(arbDifficulty, arbStability, arbR, (d, s, r) => {
        const hard = nextRecallStability(P, d, s, r, 2);
        const good = nextRecallStability(P, d, s, r, 3);
        const easy = nextRecallStability(P, d, s, r, 4);
        return hard <= good + 1e-9 && good <= easy + 1e-9;
      }),
      { numRuns: 3000 },
    );
  });

  it('rewards recalling something you had nearly forgotten — the spacing effect', () => {
    fc.assert(
      fc.property(arbDifficulty, arbStability, (d, s) => {
        const reviewedTooEarly = nextRecallStability(P, d, s, 0.99, 3);
        const reviewedJustInTime = nextRecallStability(P, d, s, 0.6, 3);
        return reviewedJustInTime > reviewedTooEarly;
      }),
      { numRuns: 2000 },
    );
  });

  it('gives an easier card more benefit from the same review', () => {
    fc.assert(
      fc.property(arbStability, arbR, (s, r) => {
        const hardCard = nextRecallStability(P, 9, s, r, 3);
        const easyCard = nextRecallStability(P, 2, s, r, 3);
        return easyCard >= hardCard - 1e-9;
      }),
      { numRuns: 2000 },
    );
  });

  it('never falls on a same-day repeat unless the answer was Again', () => {
    fc.assert(
      fc.property(arbStability, fc.constantFrom<Rating>(2, 3, 4), (s, g) =>
        nextShortTermStability(P, s, g) >= s - 1e-9,
      ),
      { numRuns: 2000 },
    );
  });

  it('gives diminishing returns to cramming an already-stable card', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 365, noNaN: true, noDefaultInfinity: true }), (s) => {
        const gain = nextShortTermStability(P, s, 3) / s;
        const gainWhenStronger = nextShortTermStability(P, s * 10, 3) / (s * 10);
        return gainWhenStronger <= gain + 1e-9;
      }),
      { numRuns: 1000 },
    );
  });
});

// ---------------------------------------------------------------------------
// Scheduler invariants. These hold for any card, any rating, any moment --
// they are the rules the state machine may never break, whatever the numbers.
// ---------------------------------------------------------------------------

const T0 = new Date('2026-01-01T09:00:00Z');

/** Any card the state machine could plausibly hand us. */
const arbCard = fc.record({
  state: fc.constantFrom<CardState>('NEW', 'LEARNING', 'REVIEW', 'RELEARNING'),
  stability: arbStability,
  difficulty: arbDifficulty,
  reps: fc.integer({ min: 0, max: 500 }),
  lapses: fc.integer({ min: 0, max: 50 }),
  learningStep: fc.integer({ min: 0, max: 1 }),
  daysAgo: fc.double({ min: 0, max: 400, noNaN: true, noDefaultInfinity: true }),
}).map(({ daysAgo, ...rest }): SchedulingCard => ({
  ...rest,
  lastReviewedAt: rest.state === 'NEW' ? null : addDays(T0, -daysAgo),
  dueAt: T0,
}));

describe('scheduler invariants', () => {
  it('always schedules the card into the future', () => {
    fc.assert(
      fc.property(arbCard, arbRating, (card, rating) => {
        const { card: next } = schedule(card, rating, T0);
        return next.dueAt.getTime() > T0.getTime();
      }),
      { numRuns: 3000 },
    );
  });

  it('counts exactly one review, every time', () => {
    fc.assert(
      fc.property(arbCard, arbRating, (card, rating) => {
        const { card: next } = schedule(card, rating, T0);
        return next.reps === card.reps + 1 && next.lastReviewedAt?.getTime() === T0.getTime();
      }),
      { numRuns: 2000 },
    );
  });

  it('never un-counts a lapse, and only adds one when review breaks', () => {
    fc.assert(
      fc.property(arbCard, arbRating, (card, rating) => {
        const { card: next } = schedule(card, rating, T0);
        const expected = card.lapses + (card.state === 'REVIEW' && rating === 1 ? 1 : 0);
        return next.lapses === expected;
      }),
      { numRuns: 3000 },
    );
  });

  it('keeps stability and difficulty inside the model bounds', () => {
    fc.assert(
      fc.property(arbCard, arbRating, (card, rating) => {
        const { card: next } = schedule(card, rating, T0);
        return (
          Number.isFinite(next.stability) &&
          next.stability >= S_MIN &&
          next.stability <= S_MAX &&
          next.difficulty >= D_MIN &&
          next.difficulty <= D_MAX
        );
      }),
      { numRuns: 3000 },
    );
  });

  it('never leaves a card in NEW once it has been reviewed', () => {
    fc.assert(
      fc.property(arbCard, arbRating, (card, rating) => {
        return schedule(card, rating, T0).card.state !== 'NEW';
      }),
      { numRuns: 2000 },
    );
  });

  it('writes a log that carries the state the card came from', () => {
    fc.assert(
      fc.property(arbCard, arbRating, (card, rating) => {
        const { log } = schedule(card, rating, T0);
        return (
          log.prevState === card.state &&
          log.prevStability === card.stability &&
          log.prevDifficulty === card.difficulty &&
          log.rating === rating &&
          log.retrievability >= 0 &&
          log.retrievability <= 1
        );
      }),
      { numRuns: 2000 },
    );
  });

  it('never brings a card back sooner for a better answer', () => {
    fc.assert(
      fc.property(arbCard, (card) => {
        const due = ([1, 2, 3, 4] as Rating[]).map(
          (r) => schedule(card, r, T0).card.dueAt.getTime(),
        );
        return due.every((d, i) => i === 0 || d >= due[i - 1]! - 1);
      }),
      { numRuns: 3000 },
    );
  });

  it('is a pure function — same inputs, same result, always', () => {
    fc.assert(
      fc.property(arbCard, arbRating, (card, rating) => {
        return (
          JSON.stringify(schedule(card, rating, T0)) ===
          JSON.stringify(schedule(card, rating, T0))
        );
      }),
      { numRuns: 1000 },
    );
  });
});
