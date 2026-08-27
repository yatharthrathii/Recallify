/**
 * Training tests.
 *
 * The claim being tested is narrow and checkable: given a history produced by
 * a learner whose real parameters are known, training must move the model
 * toward those parameters and away from the published defaults.
 */

import { DEFAULT_CONFIG, DEFAULT_PARAMS } from '@recallify/fsrs';
import { describe, expect, it } from 'vitest';
import { withinBounds } from '../src/bounds';
import { evaluate } from '../src/evaluate';
import { MIN_REVIEWS, numericalGradient, optimize } from '../src/train';
import { perturb, simulateLearner } from './simulate';

/**
 * A learner who forgets faster than average (w20 up), gains less from each
 * review (w8 down), and hits diminishing returns sooner (w9 up).
 */
const TRUE_PARAMS = perturb(DEFAULT_PARAMS, { 20: 0.35, 8: 1.2, 9: 0.35 });

const history = simulateLearner({
  trueParams: TRUE_PARAMS,
  cards: 90,
  days: 400,
  seed: 7,
});

const lossWithDefaults = evaluate(history, DEFAULT_PARAMS).logLoss;
const lossWithTruth = evaluate(history, TRUE_PARAMS).logLoss;

const trained = optimize(history, { maxIterations: 25 });

describe('the training set', () => {
  it('is big enough to fit on', () => {
    expect(history.length).toBeGreaterThan(MIN_REVIEWS);
  });

  it('is genuinely explained better by the parameters that produced it', () => {
    // Without this the rest of the file proves nothing: if the defaults already
    // fitted, there would be nothing for training to find.
    expect(lossWithTruth).toBeLessThan(lossWithDefaults);
  });
});

describe('gradient', () => {
  it('has one entry per parameter and all of them finite', () => {
    const grad = numericalGradient(history, DEFAULT_PARAMS, lossWithDefaults);
    expect(grad).toHaveLength(21);
    expect(grad.every(Number.isFinite)).toBe(true);
  });

  it('points somewhere — a flat gradient would mean nothing to learn', () => {
    const grad = numericalGradient(history, DEFAULT_PARAMS, lossWithDefaults);
    expect(grad.some((g) => Math.abs(g) > 1e-6)).toBe(true);
  });
});

describe('training', () => {
  it('lowers the loss', () => {
    expect(trained.finalLoss).toBeLessThan(trained.initialLoss);
  });

  it('never lets the loss go back up — every accepted step is an improvement', () => {
    for (let i = 1; i < trained.trace.length; i++) {
      expect(trained.trace[i]!).toBeLessThan(trained.trace[i - 1]!);
    }
  });

  it('closes most of the gap toward the parameters that generated the data', () => {
    const gap = lossWithDefaults - lossWithTruth;
    const closed = lossWithDefaults - trained.finalLoss;
    // Not all of it: 400 days of one simulated learner is not enough to recover
    // 21 parameters exactly, and claiming otherwise would be overfitting.
    expect(closed / gap).toBeGreaterThan(0.5);
  });

  it('keeps every parameter inside its valid range', () => {
    expect(withinBounds(trained.params)).toBe(true);
  });

  it('improves calibration, not just the number it optimises', () => {
    const before = evaluate(history, DEFAULT_PARAMS);
    const after = evaluate(history, trained.params);
    expect(after.calibrationError).toBeLessThan(before.calibrationError);
  });

  it('records the loss after every accepted step', () => {
    expect(trained.trace[0]).toBe(trained.initialLoss);
    expect(trained.trace.at(-1)).toBe(trained.finalLoss);
  });

  it('is deterministic — the same history always fits the same parameters', () => {
    const again = optimize(history, { maxIterations: 4 });
    const once = optimize(history, { maxIterations: 4 });
    expect(again.params).toEqual(once.params);
    expect(again.finalLoss).toBe(once.finalLoss);
  });

  it('reports that it ran out of iterations rather than pretending to converge', () => {
    const short = optimize(history, { maxIterations: 2 });
    expect(short.iterations).toBe(2);
    expect(short.converged).toBe(false);
  });

  it('stops early once the steps stop being worth taking', () => {
    // A loose tolerance means the first small improvement ends the run.
    const lazy = optimize(history, { maxIterations: 25, tolerance: 1 });
    expect(lazy.converged).toBe(true);
    expect(lazy.iterations).toBeLessThan(25);
  });

  it('backs off a learning rate that is far too large', () => {
    // A rate this size overshoots wildly; without backtracking the run would
    // either diverge or make no progress at all.
    const wild = optimize(history, { maxIterations: 3, learningRate: 500 });
    expect(wild.finalLoss).toBeLessThanOrEqual(wild.initialLoss);
    expect(withinBounds(wild.params)).toBe(true);
  });

  it('gives up rather than thrashing when no step of any size helps', () => {
    // Starting from the fitted parameters with a tiny rate, there is nothing
    // left to gain, so it should report convergence immediately.
    const stuck = optimize(history, {
      startingParams: trained.params,
      maxIterations: 10,
      learningRate: 1e-9,
    });
    expect(stuck.converged).toBe(true);
    expect(stuck.iterations).toBeLessThanOrEqual(2);
  });

  it('accepts a starting point other than the defaults', () => {
    const fromTruth = optimize(history, {
      startingParams: TRUE_PARAMS,
      maxIterations: 2,
    });
    expect(fromTruth.initialLoss).toBeCloseTo(lossWithTruth, 10);
  });

  it('refuses to fit a history too small to learn anything from', () => {
    const tiny = history.slice(0, MIN_REVIEWS - 1);
    expect(() => optimize(tiny)).toThrow(RangeError);
    expect(() => optimize(tiny)).toThrow(/at least 400 reviews/);
  });
});

describe('training options', () => {
  it('honours a caller-supplied scheduling config', () => {
    // One learning step instead of two means cards graduate a review earlier,
    // which changes every stability that follows and therefore the loss.
    //
    // Note it is the NUMBER of steps that matters, not their length: [1, 10]
    // and [5, 30] produce identical state transitions, because evaluate replays
    // reviews at the times they actually happened rather than when they were
    // due.
    const quick = optimize(history, {
      maxIterations: 1,
      config: { ...DEFAULT_CONFIG, learningSteps: [10] },
    });
    expect(quick.initialLoss).not.toBe(lossWithDefaults);
    expect(Number.isFinite(quick.initialLoss)).toBe(true);
  });

  it('uses its own iteration ceiling when the caller does not set one', () => {
    // The loose tolerance ends the run after one accepted step, so this checks
    // the default is applied without paying for 60 iterations.
    const unbounded = optimize(history, { tolerance: 1 });
    expect(unbounded.converged).toBe(true);
    expect(unbounded.iterations).toBeGreaterThan(0);
    expect(unbounded.iterations).toBeLessThan(60);
  });

  it('gives up immediately when the step size is zero', () => {
    // A zero rate can never move the parameters, so no candidate is ever an
    // improvement and the search has to recognise that rather than spin.
    const frozen = optimize(history, { maxIterations: 5, learningRate: 0 });
    expect(frozen.converged).toBe(true);
    expect(frozen.iterations).toBe(1);
    expect(frozen.finalLoss).toBe(frozen.initialLoss);
    expect(frozen.params).toEqual([...DEFAULT_PARAMS]);
  });
});
