/**
 * Differential test against ts-fsrs.
 *
 * ts-fsrs (open-spaced-repetition) is the established TypeScript implementation
 * of FSRS. It is a DEV dependency only and is never shipped: it is used here as
 * a test oracle. Our implementation is written from the published algorithm,
 * and these tests assert the two agree across thousands of generated cases.
 *
 * This is what makes "I implemented FSRS from the published algorithm" a
 * provable statement rather than an assertion.
 */

import fc from 'fast-check';
import { FSRSAlgorithm, forgetting_curve, generatorParameters } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, S_MAX, S_MIN } from '../src/constants';
import {
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
import type { Rating } from '../src/types';

// ts-fsrs rounds several intermediates to 8 decimal places. Anything tighter
// than this would be testing their rounding, not our maths.
const EPSILON = 1e-6;

const reference = new FSRSAlgorithm(generatorParameters({ w: [...DEFAULT_PARAMS] }));

const RATINGS: readonly Rating[] = [1, 2, 3, 4];
const arbRating = fc.constantFrom<Rating>(...RATINGS);
const arbStability = fc.double({ min: S_MIN, max: 3650, noNaN: true, noDefaultInfinity: true });
const arbDifficulty = fc.double({ min: 1, max: 10, noNaN: true, noDefaultInfinity: true });
const arbRetrievability = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
const arbElapsed = fc.double({ min: 0, max: 3650, noNaN: true, noDefaultInfinity: true });

/** Relative comparison: absolute error is meaningless when S can reach 36500. */
function agrees(ours: number, theirs: number): boolean {
  if (Number.isNaN(ours) || Number.isNaN(theirs)) return false;
  const scale = Math.max(1, Math.abs(theirs));
  return Math.abs(ours - theirs) / scale <= EPSILON;
}

describe('differential: ts-fsrs is the oracle', () => {
  it('uses the same published FSRS-6 parameters', () => {
    expect([...DEFAULT_PARAMS]).toEqual([...generatorParameters().w]);
    expect(DEFAULT_PARAMS).toHaveLength(21);
  });

  it('agrees on the decay exponent', () => {
    // ts-fsrs stores decay positive; the curve applies it negated.
    expect(decay(DEFAULT_PARAMS)).toBeCloseTo(-0.1542, 10);
  });

  it('agrees on the forgetting curve', () => {
    fc.assert(
      fc.property(arbElapsed, arbStability, (elapsed, stability) => {
        const ours = retrievability(DEFAULT_PARAMS, elapsed, stability);
        const theirs = forgetting_curve([...DEFAULT_PARAMS], elapsed, stability);
        return agrees(ours, theirs);
      }),
      { numRuns: 2000 },
    );
  });

  it('agrees on initial stability for every rating', () => {
    for (const rating of RATINGS) {
      expect(agrees(initialStability(DEFAULT_PARAMS, rating), reference.init_stability(rating))).toBe(
        true,
      );
    }
  });

  it('agrees on initial difficulty for every rating', () => {
    for (const rating of RATINGS) {
      expect(
        agrees(initialDifficulty(DEFAULT_PARAMS, rating), reference.init_difficulty(rating)),
      ).toBe(true);
    }
  });

  it('agrees on linear damping', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
        arbDifficulty,
        (delta, difficulty) =>
          agrees(linearDamping(delta, difficulty), reference.linear_damping(delta, difficulty)),
      ),
      { numRuns: 1000 },
    );
  });

  it('agrees on mean reversion', () => {
    fc.assert(
      fc.property(arbDifficulty, arbDifficulty, (init, current) =>
        agrees(
          meanReversion(DEFAULT_PARAMS, init, current),
          reference.mean_reversion(init, current),
        ),
      ),
      { numRuns: 1000 },
    );
  });

  it('agrees on the difficulty update', () => {
    fc.assert(
      fc.property(arbDifficulty, arbRating, (difficulty, rating) =>
        agrees(
          nextDifficulty(DEFAULT_PARAMS, difficulty, rating),
          reference.next_difficulty(difficulty, rating),
        ),
      ),
      { numRuns: 2000 },
    );
  });

  it('agrees on stability after a successful recall', () => {
    fc.assert(
      fc.property(
        arbDifficulty,
        arbStability,
        arbRetrievability,
        fc.constantFrom<Rating>(2, 3, 4),
        (d, s, r, g) =>
          agrees(
            nextRecallStability(DEFAULT_PARAMS, d, s, r, g),
            reference.next_recall_stability(d, s, r, g),
          ),
      ),
      { numRuns: 3000 },
    );
  });

  it('agrees on stability after a lapse', () => {
    fc.assert(
      fc.property(arbDifficulty, arbStability, arbRetrievability, (d, s, r) =>
        agrees(
          nextForgetStability(DEFAULT_PARAMS, d, s, r),
          reference.next_forget_stability(d, s, r),
        ),
      ),
      { numRuns: 3000 },
    );
  });

  it('agrees on same-day short-term stability', () => {
    fc.assert(
      fc.property(arbStability, arbRating, (s, g) =>
        agrees(
          nextShortTermStability(DEFAULT_PARAMS, s, g),
          reference.next_short_term_stability(s, g),
        ),
      ),
      { numRuns: 3000 },
    );
  });

  it('agrees on the interval implied by the desired retention', () => {
    fc.assert(
      fc.property(arbStability, (stability) => {
        // ts-fsrs next_interval bakes in rounding and the maximum-interval clamp;
        // compare the raw continuous value against its documented identity
        // instead: at r = 0.9 the interval must equal stability.
        const ours = intervalFromRetention(DEFAULT_PARAMS, stability, 0.9);
        return agrees(ours, stability);
      }),
      { numRuns: 2000 },
    );
  });

  it('never produces a stability outside the model bounds', () => {
    fc.assert(
      fc.property(arbDifficulty, arbStability, arbRetrievability, arbRating, (d, s, r, g) => {
        const values = [
          nextRecallStability(DEFAULT_PARAMS, d, s, r, g),
          nextForgetStability(DEFAULT_PARAMS, d, s, r),
          nextShortTermStability(DEFAULT_PARAMS, s, g),
        ];
        return values.every((v) => Number.isFinite(v) && v >= S_MIN && v <= S_MAX);
      }),
      { numRuns: 2000 },
    );
  });
});
