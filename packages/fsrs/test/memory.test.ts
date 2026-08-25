/**
 * Unit tests with concrete numbers.
 *
 * The property tests prove the model behaves correctly in general and the
 * differential tests prove it matches the reference. These exist so a person
 * can read the file and see what the model actually does — real values, and
 * the reasoning behind each one.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS as P,
  S_MAX,
  S_MIN,
  clamp,
  w,
} from '../src/constants';
import { DAY_MS, addDays, elapsedDays, newCard } from '../src/defaults';
import {
  curveFactor,
  decay,
  initialDifficulty,
  initialStability,
  intervalFromRetention,
  linearDamping,
  meanReversion,
  nextDifficulty,
  nextForgetStability,
  nextRecallStability,
  nextShortTermStability,
  retrievability,
} from '../src/memory';

describe('parameters', () => {
  it('ships the 21 published FSRS-6 weights', () => {
    expect(P).toHaveLength(21);
    expect(w(P, 0)).toBe(0.212);
    expect(w(P, 20)).toBe(0.1542);
  });

  it('throws rather than silently producing NaN when a weight is missing', () => {
    expect(() => w([0.1, 0.2], 20)).toThrow(RangeError);
    expect(() => w([0.1, 0.2], 20)).toThrow('w[20]');
  });

  it('clamps at both ends and passes values through in range', () => {
    expect(clamp(-5, 1, 10)).toBe(1);
    expect(clamp(50, 1, 10)).toBe(10);
    expect(clamp(4.2, 1, 10)).toBe(4.2);
  });
});

describe('forgetting curve', () => {
  it('derives decay from w[20] by negating it', () => {
    expect(decay(P)).toBeCloseTo(-0.1542, 10);
  });

  it('anchors the curve so that R(S, S) is exactly 0.9', () => {
    expect(curveFactor(P)).toBeCloseTo(0.98035, 5);
    expect(retrievability(P, 100, 100)).toBeCloseTo(0.9, 10);
  });

  it('predicts recall for a card with 5 days of stability', () => {
    // 10 days elapsed on a memory worth 5 days: roughly 85% still recallable.
    expect(retrievability(P, 10, 5)).toBeCloseTo(0.84588465, 8);
  });

  it('decays slowly, not exponentially — the long tail is the point', () => {
    const s = 10;
    // An exponential curve at 10x stability would be near zero. This one is
    // still around 69%, which is why FSRS-4.5 moved to a power curve: it fits
    // real review logs, and it is what makes long intervals defensible.
    expect(retrievability(P, 10, s)).toBeCloseTo(0.9, 6); // 1x  stability
    expect(retrievability(P, 50, s)).toBeCloseTo(0.7605, 3); // 5x
    expect(retrievability(P, 100, s)).toBeCloseTo(0.6928, 3); // 10x
    expect(retrievability(P, 1000, s)).toBeGreaterThan(0.45); // 100x, still not gone
  });
});

describe('interval', () => {
  it('at 90% retention the interval equals stability, by definition', () => {
    expect(intervalFromRetention(P, 30, 0.9)).toBeCloseTo(30, 8);
  });

  it('shows what a stricter retention target costs', () => {
    const s = 100;
    // This is the number behind the retention slider in the UI.
    expect(intervalFromRetention(P, s, 0.8)).toBeGreaterThan(200);
    expect(intervalFromRetention(P, s, 0.9)).toBeCloseTo(100, 6);
    expect(intervalFromRetention(P, s, 0.95)).toBeLessThan(50);
  });
});

describe('first review', () => {
  it('assigns stability straight from w[0..3]', () => {
    expect(initialStability(P, 1)).toBeCloseTo(0.212, 6); // Again: hours
    expect(initialStability(P, 2)).toBeCloseTo(1.2931, 6); // Hard:  ~1 day
    expect(initialStability(P, 3)).toBeCloseTo(2.3065, 6); // Good:  ~2 days
    expect(initialStability(P, 4)).toBeCloseTo(8.2956, 6); // Easy:  ~8 days
  });

  it('assigns difficulty that falls exponentially with the rating', () => {
    expect(initialDifficulty(P, 1)).toBeCloseTo(6.4133, 6);
    expect(initialDifficulty(P, 2)).toBeCloseTo(5.11217071, 6);
    expect(initialDifficulty(P, 3)).toBeCloseTo(2.11810397, 6);
    // Below the [1,10] range on purpose: this is the mean-reversion target,
    // and the scheduler clamps only when writing difficulty to a card.
    expect(initialDifficulty(P, 4)).toBeCloseTo(-4.7716307, 6);
  });
});

describe('difficulty update', () => {
  it('damps the change as difficulty approaches the ceiling', () => {
    // Same raw delta, but an already-hard card barely moves.
    expect(linearDamping(3, 1)).toBeCloseTo(3, 6);
    expect(linearDamping(3, 9.5)).toBeCloseTo(0.1667, 3);
    expect(linearDamping(3, 10)).toBe(0);
  });

  it('mean-reverts toward the target in proportion to w[7]', () => {
    expect(meanReversion(P, 0, 10)).toBeCloseTo(10 * (1 - w(P, 7)), 8);
  });

  it('moves an easy card up after a lapse', () => {
    expect(nextDifficulty(P, 1, 1)).toBeCloseTo(7.02698957, 6);
  });

  it('cannot escape [1, 10] in either direction', () => {
    expect(nextDifficulty(P, 10, 1)).toBeLessThanOrEqual(10);
    expect(nextDifficulty(P, 1, 4)).toBeGreaterThanOrEqual(1);
  });
});

describe('stability update', () => {
  const d = 5;
  const s = 30;

  it('grows stability on recall, and grows it more for a better answer', () => {
    const r = retrievability(P, 30, s); // reviewed exactly on time
    const hard = nextRecallStability(P, d, s, r, 2);
    const good = nextRecallStability(P, d, s, r, 3);
    const easy = nextRecallStability(P, d, s, r, 4);

    expect(hard).toBeGreaterThan(s);
    expect(good).toBeGreaterThan(hard);
    expect(easy).toBeGreaterThan(good);
  });

  it('pays far more for a review that was nearly forgotten', () => {
    const early = nextRecallStability(P, d, s, 0.99, 3); // crammed
    const late = nextRecallStability(P, d, s, 0.7, 3); // just in time
    expect(late / early).toBeGreaterThan(2);
  });

  it('collapses stability on a lapse', () => {
    const r = retrievability(P, 30, s);
    const after = nextForgetStability(P, d, s, r);
    expect(after).toBeLessThan(s / 5);
    expect(after).toBeGreaterThan(S_MIN);
  });

  it('adds little for a same-day repeat of an already-strong card', () => {
    const weak = nextShortTermStability(P, 1, 3) / 1;
    const strong = nextShortTermStability(P, 365, 3) / 365;
    expect(weak).toBeGreaterThan(strong);
  });

  it('lets Again reduce stability on a same-day repeat, but nothing else can', () => {
    expect(nextShortTermStability(P, 10, 1)).toBeLessThan(10);
    expect(nextShortTermStability(P, 10, 2)).toBeGreaterThanOrEqual(10);
  });

  it('clamps at the model ceiling', () => {
    expect(nextRecallStability(P, 1, S_MAX, 0.1, 4)).toBe(S_MAX);
  });
});

describe('card and date helpers', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('creates a new card that is due immediately', () => {
    const card = newCard(now);
    expect(card.state).toBe('NEW');
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.lastReviewedAt).toBeNull();
    expect(card.dueAt).toEqual(now);
  });

  it('counts whole elapsed days', () => {
    expect(elapsedDays(now, addDays(now, 9))).toBe(9);
    expect(elapsedDays(now, addDays(now, 9.9))).toBe(9);
  });

  it('clamps a backwards clock to zero instead of going negative', () => {
    // An offline device can submit a review stamped before the previous one.
    expect(elapsedDays(addDays(now, 5), now)).toBe(0);
  });

  it('supports fractional days, because learning steps are minutes', () => {
    expect(addDays(now, 0.5).toISOString()).toBe('2026-01-01T12:00:00.000Z');
    expect(addDays(now, 1).getTime() - now.getTime()).toBe(DAY_MS);
  });
});
