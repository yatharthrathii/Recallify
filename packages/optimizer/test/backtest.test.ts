import { DEFAULT_PARAMS } from '@recallify/fsrs';
import { describe, expect, it } from 'vitest';
import { backtest } from '../src/backtest';
import { optimize } from '../src/train';
import { perturb, simulateLearner } from './simulate';

const SLOW_FORGETTER = perturb(DEFAULT_PARAMS, { 20: 0.11, 8: 2.6 });

const history = simulateLearner({
  trueParams: SLOW_FORGETTER,
  cards: 80,
  days: 400,
  seed: 11,
});

const fitted = optimize(history, { maxIterations: 20 });
const result = backtest(history, fitted.params);

describe('backtest', () => {
  it('scores both parameter sets on exactly the same history', () => {
    expect(result.baseline.predictions).toBe(result.candidate.predictions);
    expect(result.baseline.actualRetention).toBeCloseTo(result.candidate.actualRetention, 10);
  });

  it('shows the fitted parameters predicting better than the defaults', () => {
    expect(result.candidate.logLoss).toBeLessThan(result.baseline.logLoss);
    expect(result.lossImprovement).toBeGreaterThan(0);
  });

  it('reports honest calibration for both sides', () => {
    expect(result.candidate.calibrationError).toBeLessThan(result.baseline.calibrationError);
  });

  it('reports the workload each parameter set implies', () => {
    // A learner who forgets slowly than average should end up with longer
    // intervals once the model knows that -- so, less daily work.
    expect(result.candidate.averageIntervalDays).toBeGreaterThan(
      result.baseline.averageIntervalDays,
    );
    expect(result.workloadChange).toBeLessThan(0);
  });

  it('compares against the published defaults unless told otherwise', () => {
    const explicit = backtest(history, fitted.params, DEFAULT_PARAMS);
    expect(explicit.baseline.logLoss).toBeCloseTo(result.baseline.logLoss, 12);
  });

  it('can compare any two parameter sets, not just against the defaults', () => {
    const custom = backtest(history, DEFAULT_PARAMS, SLOW_FORGETTER);
    expect(custom.baseline.logLoss).toBeLessThan(custom.candidate.logLoss);
    expect(custom.lossImprovement).toBeLessThan(0);
  });

  it('returns zeros rather than dividing by zero on an empty history', () => {
    const empty = backtest([], DEFAULT_PARAMS);
    expect(empty.lossImprovement).toBe(0);
    expect(empty.workloadChange).toBe(0);
    expect(empty.baseline.predictions).toBe(0);
  });
});
