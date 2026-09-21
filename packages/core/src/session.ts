import type { QueueCard, SchedulingConfig } from '@recallify/contracts';
import {
  DAY_MS,
  DEFAULT_CONFIG,
  schedule,
  type FsrsConfig,
  type Rating,
  type SchedulingCard,
} from '@recallify/fsrs';

/**
 * The review session, as a pure state machine.
 *
 * No React, no network, no clock: every function takes the current state and
 * returns the next one, and `now` is always passed in. The web app drives it
 * from a reducer and the phone will drive the same code from its own, which is
 * the whole reason it lives here and not in a component.
 *
 * Scheduling happens locally, with the same engine and the same parameters the
 * server uses, so rating a card advances instantly instead of waiting on a
 * round trip. The server's answer replaces the local one when it arrives; it
 * is the record, this is the preview.
 */

/**
 * A card answered now and due again within this window comes back in the same
 * session, as Anki does. Without it a card on a one-minute learning step would
 * vanish until the user happened to open the app again.
 */
export const LEARN_AHEAD_MS = 20 * 60_000;

export interface SessionTally {
  readonly reviewed: number;
  readonly again: number;
  readonly hard: number;
  readonly good: number;
  readonly easy: number;
}

export interface SessionState {
  readonly queue: readonly QueueCard[];
  readonly revealed: boolean;
  readonly tally: SessionTally;
  /** Cards in the queue when the session started, for the progress bar. */
  readonly initialCount: number;
}

/** What rating a card produced: the next state, and the review to send. */
export interface RateResult {
  readonly state: SessionState;
  readonly submission: {
    readonly cardId: string;
    readonly rating: Rating;
    readonly reviewedAt: Date;
  };
  /** Days until the card is next due, by the local engine. */
  readonly intervalDays: number;
  readonly requeued: boolean;
}

const EMPTY_TALLY: SessionTally = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
const TALLY_KEY = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const;

export function toFsrsConfig(config: SchedulingConfig): FsrsConfig {
  return {
    ...DEFAULT_CONFIG,
    params: config.params,
    desiredRetention: config.desiredRetention,
    maximumInterval: config.maximumInterval,
    learningSteps: config.learningSteps,
    relearningSteps: config.relearningSteps,
  };
}

function toSchedulingCard(card: QueueCard): SchedulingCard {
  return {
    state: card.state,
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    lastReviewedAt: card.lastReviewedAt,
    dueAt: card.dueAt,
    learningStep: card.learningStep,
  };
}

export function startSession(cards: readonly QueueCard[]): SessionState {
  return { queue: cards, revealed: false, tally: EMPTY_TALLY, initialCount: cards.length };
}

export function currentCard(state: SessionState): QueueCard | null {
  return state.queue[0] ?? null;
}

export function reveal(state: SessionState): SessionState {
  return state.revealed || state.queue.length === 0 ? state : { ...state, revealed: true };
}

/**
 * What each button would do to the card in front of the user, in days.
 *
 * Computed by running the scheduler four times rather than by a second formula
 * that approximates it. Fuzz is off, so these are the centre of what the
 * server will choose, not a promise of the exact day.
 */
export function previewIntervals(
  card: QueueCard,
  now: Date,
  config: FsrsConfig,
): Record<'again' | 'hard' | 'good' | 'easy', number> {
  const from = toSchedulingCard(card);
  const days = (rating: Rating): number =>
    Math.max(0, (schedule(from, rating, now, config).card.dueAt.getTime() - now.getTime()) / DAY_MS);
  return { again: days(1), hard: days(2), good: days(3), easy: days(4) };
}

/** Rate the card at the front of the queue. Null if there is nothing to rate. */
export function rate(
  state: SessionState,
  rating: Rating,
  now: Date,
  config: FsrsConfig,
): RateResult | null {
  const card = state.queue[0];
  if (!card) return null;

  const next = schedule(toSchedulingCard(card), rating, now, config).card;
  const untilDue = next.dueAt.getTime() - now.getTime();
  const requeued = untilDue <= LEARN_AHEAD_MS;

  const rest = state.queue.slice(1);
  const queue = requeued
    ? [
        ...rest,
        {
          ...card,
          state: next.state,
          stability: next.stability,
          difficulty: next.difficulty,
          reps: next.reps,
          lapses: next.lapses,
          lastReviewedAt: next.lastReviewedAt,
          dueAt: next.dueAt,
          learningStep: next.learningStep,
          // Just answered, so it is as fresh as it will ever be.
          retrievability: 1,
        },
      ]
    : rest;

  const key = TALLY_KEY[rating];
  return {
    state: {
      queue,
      revealed: false,
      initialCount: state.initialCount,
      tally: { ...state.tally, reviewed: state.tally.reviewed + 1, [key]: state.tally[key] + 1 },
    },
    submission: { cardId: card.id, rating, reviewedAt: now },
    intervalDays: Math.max(0, untilDue / DAY_MS),
    requeued,
  };
}

/** Distinct cards finished, as a fraction, for the progress bar. */
export function progress(state: SessionState): number {
  if (state.initialCount === 0) return 1;
  const distinctLeft = new Set(state.queue.map((c) => c.id)).size;
  return Math.min(1, Math.max(0, 1 - distinctLeft / state.initialCount));
}
