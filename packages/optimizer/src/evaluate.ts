/**
 * Scoring a parameter set against a real review history.
 *
 * The whole optimizer rests on this one idea: before every review, the model
 * had an opinion about whether the user would remember the card. The user then
 * either did or did not. Log-loss measures how wrong those opinions were, and
 * training is just "find the parameters that were least wrong".
 */

import {
  DEFAULT_CONFIG,
  newCard,
  retrievability,
  schedule,
  type FsrsConfig,
  type FsrsParams,
  type SchedulingCard,
} from '@recallify/fsrs';
import type { Evaluation, TrainingReview } from './types';

/**
 * Predictions are pulled away from 0 and 1 before taking a logarithm.
 * ln(0) is -Infinity, and one such review would swallow the entire loss.
 */
const EPS = 1e-6;

/**
 * A card the model can be asked about. Equivalent to `state !== 'NEW'` -- every
 * scheduled card has a review date and every unscheduled one does not -- but
 * phrased so TypeScript narrows the date, which removes a null check that no
 * test could ever reach.
 */
const isPredictable = (
  card: SchedulingCard,
): card is SchedulingCard & { lastReviewedAt: Date } => card.lastReviewedAt !== null;

/** Group a flat review list into per-card histories, each in chronological order. */
export function groupByCard(
  reviews: readonly TrainingReview[],
): Map<string, TrainingReview[]> {
  const byCard = new Map<string, TrainingReview[]>();

  for (const review of reviews) {
    const existing = byCard.get(review.cardId);
    if (existing) existing.push(review);
    else byCard.set(review.cardId, [review]);
  }

  for (const history of byCard.values()) {
    history.sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime());
  }

  return byCard;
}

/**
 * Replay every card's history under one parameter set and score the result.
 *
 * Note what is NOT read: the stability and difficulty stored on the review rows.
 * Those belong to whatever parameters were live at the time. Every candidate
 * produces its own, so the history has to be rebuilt from the ratings alone.
 */
export function evaluate(
  reviews: readonly TrainingReview[],
  params: FsrsParams,
  baseConfig: FsrsConfig = DEFAULT_CONFIG,
): Evaluation {
  const config: FsrsConfig = { ...baseConfig, params };

  let lossSum = 0;
  let predictedSum = 0;
  let actualSum = 0;
  let predictions = 0;

  let intervalSum = 0;
  let intervalCount = 0;

  const byCard = groupByCard(reviews);

  for (const history of byCard.values()) {
    // The card is created on the first review rather than before the loop, so
    // there is no "history is somehow empty" branch that no test could reach.
    let card: SchedulingCard | undefined;

    for (const review of history) {
      card ??= newCard(review.reviewedAt);

      if (isPredictable(card)) {
        const elapsed = Math.max(
          0,
          (review.reviewedAt.getTime() - card.lastReviewedAt.getTime()) / 86_400_000,
        );

        const raw = retrievability(params, elapsed, card.stability);
        const p = Math.min(Math.max(raw, EPS), 1 - EPS);
        const y = review.rating > 1 ? 1 : 0;

        lossSum -= y * Math.log(p) + (1 - y) * Math.log(1 - p);
        predictedSum += p;
        actualSum += y;
        predictions += 1;
      }

      const result = schedule(card, review.rating, review.reviewedAt, config);
      card = result.card;

      // Only day-scale intervals say anything about workload; learning steps
      // are minutes and would drag the average to nearly zero.
      if (card.state === 'REVIEW') {
        intervalSum += result.log.scheduledDays;
        intervalCount += 1;
      }
    }
  }

  const averageIntervalDays = intervalCount > 0 ? intervalSum / intervalCount : 0;
  const cardCount = byCard.size;

  return {
    logLoss: predictions > 0 ? lossSum / predictions : 0,
    predictions,
    predictedRetention: predictions > 0 ? predictedSum / predictions : 0,
    actualRetention: predictions > 0 ? actualSum / predictions : 0,
    calibrationError:
      predictions > 0 ? Math.abs(predictedSum - actualSum) / predictions : 0,
    averageIntervalDays,
    estimatedReviewsPerDay:
      averageIntervalDays > 0 ? cardCount / averageIntervalDays : 0,
  };
}
