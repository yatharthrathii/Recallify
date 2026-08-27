import { DEFAULT_PARAMS } from '@recallify/fsrs';
import { describe, expect, it } from 'vitest';
import { evaluate, groupByCard } from '../src/evaluate';
import { perturb, simulateLearner } from './simulate';
import type { TrainingReview } from '../src/types';

const history = simulateLearner({
  trueParams: DEFAULT_PARAMS,
  cards: 60,
  days: 300,
  seed: 42,
});

describe('grouping a review log', () => {
  it('splits by card and orders each card chronologically', () => {
    const shuffled: TrainingReview[] = [
      { cardId: 'b', rating: 3, reviewedAt: new Date('2026-03-01') },
      { cardId: 'a', rating: 1, reviewedAt: new Date('2026-02-01') },
      { cardId: 'b', rating: 4, reviewedAt: new Date('2026-01-01') },
      { cardId: 'a', rating: 3, reviewedAt: new Date('2026-01-15') },
    ];

    const grouped = groupByCard(shuffled);
    expect([...grouped.keys()].sort()).toEqual(['a', 'b']);
    expect(grouped.get('b')!.map((r) => r.rating)).toEqual([4, 3]);
    expect(grouped.get('a')!.map((r) => r.rating)).toEqual([3, 1]);
  });

  it('handles an empty log', () => {
    expect(groupByCard([]).size).toBe(0);
  });
});

describe('scoring a parameter set', () => {
  it('produces a usable history to score', () => {
    expect(history.length).toBeGreaterThan(400);
  });

  it('scores the parameters that generated the data best', () => {
    const truth = evaluate(history, DEFAULT_PARAMS).logLoss;

    // Same learner, but the model believes they forget much faster and gain
    // far more from each review. It should explain the data worse.
    const wrong = evaluate(history, perturb(DEFAULT_PARAMS, { 20: 0.6, 8: 3.5 })).logLoss;

    expect(truth).toBeLessThan(wrong);
  });

  it('beats guessing', () => {
    // Always predicting 50% gives a log-loss of ln 2. Anything above that means
    // the model is worse than a coin.
    expect(evaluate(history, DEFAULT_PARAMS).logLoss).toBeLessThan(Math.log(2));
  });

  it('is well calibrated on the parameters that generated the data', () => {
    const e = evaluate(history, DEFAULT_PARAMS);
    expect(e.calibrationError).toBeLessThan(0.03);
    expect(e.predictedRetention).toBeGreaterThan(0.8);
    expect(e.actualRetention).toBeGreaterThan(0.8);
  });

  it('skips first-ever reviews, which have no memory to predict from', () => {
    const e = evaluate(history, DEFAULT_PARAMS);
    const cards = groupByCard(history).size;
    expect(e.predictions).toBe(history.length - cards);
  });

  it('reports a workload that matches the intervals it schedules', () => {
    const e = evaluate(history, DEFAULT_PARAMS);
    const cards = groupByCard(history).size;
    expect(e.averageIntervalDays).toBeGreaterThan(1);
    expect(e.estimatedReviewsPerDay).toBeCloseTo(cards / e.averageIntervalDays, 6);
  });

  it('predicts shorter intervals for a model that expects faster forgetting', () => {
    const patient = evaluate(history, perturb(DEFAULT_PARAMS, { 20: 0.12 }));
    const anxious = evaluate(history, perturb(DEFAULT_PARAMS, { 20: 0.6 }));
    expect(anxious.averageIntervalDays).toBeLessThan(patient.averageIntervalDays);
    expect(anxious.estimatedReviewsPerDay).toBeGreaterThan(patient.estimatedReviewsPerDay);
  });

  it('returns zeros rather than NaN for an empty log', () => {
    const e = evaluate([], DEFAULT_PARAMS);
    expect(e).toEqual({
      logLoss: 0,
      predictions: 0,
      predictedRetention: 0,
      actualRetention: 0,
      calibrationError: 0,
      averageIntervalDays: 0,
      estimatedReviewsPerDay: 0,
    });
  });

  it('returns zeros when every card has only ever been seen once', () => {
    const firstSightOnly: TrainingReview[] = [
      { cardId: 'a', rating: 3, reviewedAt: new Date('2026-01-01') },
      { cardId: 'b', rating: 2, reviewedAt: new Date('2026-01-01') },
    ];
    const e = evaluate(firstSightOnly, DEFAULT_PARAMS);
    expect(e.predictions).toBe(0);
    expect(e.logLoss).toBe(0);
    expect(e.predictedRetention).toBe(0);
  });

  it('is deterministic', () => {
    expect(evaluate(history, DEFAULT_PARAMS)).toEqual(evaluate(history, DEFAULT_PARAMS));
  });
});
