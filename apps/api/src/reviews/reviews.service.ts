import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Card as CardRow } from '@prisma/client';
import type {
  BatchReviewRequest,
  BatchReviewResponse,
  Explanation,
  QueueQuery,
  QueueResponse,
  ReviewHistoryItem,
  ReviewHistoryQuery,
  ReviewOutcome,
  SubmitReviewRequest,
} from '@recallify/contracts';
import {
  DAY_MS,
  elapsedDays,
  explain as explainCard,
  retrievability,
  schedule,
  type FsrsConfig,
  type Rating,
  type SchedulingCard,
} from '@recallify/fsrs';
import { startOfDay } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsConfigService } from '../scheduling/fsrs-config.service';
import { StatsService } from '../stats/stats.service';

/**
 * How far ahead of the server a device's clock is allowed to be.
 *
 * `reviewedAt` comes from the device on purpose -- a review taken on a plane
 * happened when it happened. But a phone whose clock is set to 2031 would
 * otherwise push every card years into the future, and nothing would ever come
 * back. A few minutes covers ordinary drift; beyond that the server's clock
 * wins.
 */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

/** A review lifts the card's state forward, so replaying the past is not allowed. */
function clampReviewedAt(requested: Date, lastReviewedAt: Date | null, now: Date): Date {
  const ceiling = new Date(now.getTime() + MAX_CLOCK_SKEW_MS);
  let at = requested > ceiling ? now : requested;
  // Two reviews of the same card cannot happen in the wrong order. An offline
  // batch that arrives shuffled is sorted before it gets here; this catches the
  // rest.
  if (lastReviewedAt && at < lastReviewedAt) at = lastReviewedAt;
  return at;
}

function toSchedulingCard(row: CardRow): SchedulingCard {
  return {
    state: row.state,
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    lastReviewedAt: row.lastReviewedAt,
    dueAt: row.dueAt,
    learningStep: row.learningStep,
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: FsrsConfigService,
    private readonly stats: StatsService,
  ) {}

  /**
   * Apply one review, exactly once.
   *
   * The id arrives from the device and is the primary key, so a retry, a
   * double-tap and a half-delivered offline batch all carry the same id. The
   * unique constraint is what actually enforces that -- checking first and then
   * inserting leaves a window where two concurrent copies both pass the check.
   * So the insert is attempted and P2002 is read as "already had this one".
   */
  async submit(userId: string, input: SubmitReviewRequest, now = new Date()): Promise<ReviewOutcome> {
    const config = await this.scheduling.forUser(userId);
    return this.apply(userId, input, config, now);
  }

  private async apply(
    userId: string,
    input: SubmitReviewRequest,
    config: FsrsConfig,
    now: Date,
  ): Promise<ReviewOutcome> {
    const card = await this.prisma.card.findFirst({ where: { id: input.cardId, userId } });
    if (!card) throw new NotFoundException('That card does not exist, or is not yours.');

    // No "has this id been seen?" query first. The unique primary key decides
    // it, and asking beforehand would be both a second mechanism to keep in
    // agreement and an extra round trip on every single review -- on a batch of
    // two hundred that is two hundred queries to answer a question the insert
    // answers for free.
    const reviewedAt = clampReviewedAt(input.reviewedAt, card.lastReviewedAt, now);
    const before = toSchedulingCard(card);

    // Real randomness here, not the deterministic 0.5 the tests use: fuzz is
    // what stops a hundred cards learned on one evening from all coming back on
    // the same day a month later.
    const result = schedule(before, input.rating as Rating, reviewedAt, config, Math.random());
    const { card: after, log } = result;

    const scheduledDays = Math.max(
      0,
      Math.round((after.dueAt.getTime() - reviewedAt.getTime()) / DAY_MS),
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.review.create({
          data: {
            id: input.id,
            cardId: card.id,
            userId,
            rating: input.rating,
            prevState: log.prevState,
            prevStability: log.prevStability,
            prevDifficulty: log.prevDifficulty,
            newStability: log.newStability,
            newDifficulty: log.newDifficulty,
            scheduledDays,
            elapsedDays: Math.round(log.elapsedDays),
            retrievability: log.retrievability,
            durationMs: input.durationMs ?? null,
            reviewedAt,
          },
        });

        const row = await tx.card.update({
          where: { id: card.id, userId },
          data: {
            state: after.state,
            stability: after.stability,
            difficulty: after.difficulty,
            dueAt: after.dueAt,
            reps: after.reps,
            lapses: after.lapses,
            lastReviewedAt: after.lastReviewedAt,
            learningStep: after.learningStep,
          },
        });

        // Stats owns its own table; reviews hands it the transaction rather
        // than writing user_stats itself, so xp and the review land together
        // or not at all.
        await this.stats.recordReview(tx, userId, reviewedAt);

        return row;
      });

      return { reviewId: input.id, cardId: card.id, applied: true, card: this.schedule(updated) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // This id has been stored before: a retry, a double-tap, or a resent
        // offline batch. The transaction rolled back, so nothing was counted
        // twice -- the card is read back and reported as it already stands.
        //
        // The answer is the same whether the id was this user's review or
        // someone else's. Saying "that exists but is not yours" would turn a
        // guessed UUID into an oracle.
        const current = await this.prisma.card.findFirstOrThrow({ where: { id: card.id, userId } });
        return { reviewId: input.id, cardId: card.id, applied: false, card: this.schedule(current) };
      }
      throw error;
    }
  }

  private schedule(row: CardRow): ReviewOutcome['card'] {
    return {
      state: row.state,
      stability: row.stability,
      difficulty: row.difficulty,
      dueAt: row.dueAt,
      reps: row.reps,
      lapses: row.lapses,
      lastReviewedAt: row.lastReviewedAt,
      learningStep: row.learningStep,
    };
  }

  /**
   * Offline sync.
   *
   * Applied in `reviewedAt` order, one at a time, because two reviews of the
   * same card are not independent: the second one's interval is computed from
   * the state the first one left behind. Running them in parallel would let
   * them both read the same starting state and the later one would win,
   * throwing the earlier review away.
   *
   * Each review is its own transaction rather than one big one. A batch of two
   * hundred is a long transaction to hold open on a pooled connection, and a
   * single bad card in the middle should not roll back the other 199 -- the
   * device can safely resend anything that did not land.
   */
  async batch(userId: string, input: BatchReviewRequest): Promise<BatchReviewResponse> {
    const config = await this.scheduling.forUser(userId);
    const now = new Date();

    const ordered = [...input.reviews].sort(
      (a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime(),
    );

    const outcomes: ReviewOutcome[] = [];
    for (const review of ordered) {
      outcomes.push(await this.apply(userId, review, config, now));
    }

    return {
      outcomes,
      applied: outcomes.filter((o) => o.applied).length,
      duplicates: outcomes.filter((o) => !o.applied).length,
    };
  }

  /**
   * The due queue, with the daily caps applied.
   *
   * Two separate budgets, as in Anki. Review cards are the debt already owed
   * and come first; new cards are optional and are what gets cut when the day
   * is already full. Introducing new cards while a backlog is growing is how
   * people end up with four hundred due and quit.
   */
  async queue(userId: string, query: QueueQuery): Promise<QueueResponse> {
    const config = await this.scheduling.forUser(userId);
    const now = new Date();
    const today = startOfDay(now);

    const deckFilter = query.deckId ? { deckId: query.deckId } : {};
    const base = { userId, suspendedAt: null, ...deckFilter };
    const dueFilter = query.ahead ? {} : { dueAt: { lte: now } };

    // What has already been spent today. A first-ever review of a card is one
    // whose before-state was NEW, which is why the log stores it.
    const [newToday, reviewsToday, dueTotal] = await Promise.all([
      this.prisma.review.count({
        where: { userId, reviewedAt: { gte: today }, prevState: 'NEW' },
      }),
      this.prisma.review.count({
        where: { userId, reviewedAt: { gte: today }, prevState: { not: 'NEW' } },
      }),
      this.prisma.card.count({ where: { ...base, state: { not: 'NEW' }, dueAt: { lte: now } } }),
    ]);

    const newRemaining = Math.max(0, config.dailyNewLimit - newToday);
    const reviewRemaining = Math.max(0, config.dailyReviewLimit - reviewsToday);

    const dueTake = Math.min(query.limit, reviewRemaining);
    const dueCards = dueTake
      ? await this.prisma.card.findMany({
          where: { ...base, ...dueFilter, state: { not: 'NEW' } },
          orderBy: { dueAt: 'asc' },
          take: dueTake,
          include: { deck: { select: { title: true } } },
        })
      : [];

    const newTake = Math.min(query.limit - dueCards.length, newRemaining);
    const newCards = newTake > 0
      ? await this.prisma.card.findMany({
          where: { ...base, state: 'NEW' },
          orderBy: { createdAt: 'asc' },
          take: newTake,
          include: { deck: { select: { title: true } } },
        })
      : [];

    const toQueueCard = (row: CardRow & { deck: { title: string } }) => ({
      id: row.id,
      deckId: row.deckId,
      deckTitle: row.deck.title,
      front: row.front,
      back: row.back,
      hint: row.hint,
      retrievability:
        row.state === 'NEW' || !row.lastReviewedAt
          ? 0
          : retrievability(config.params, elapsedDays(row.lastReviewedAt, now), row.stability),
      ...this.schedule(row),
    });

    return {
      cards: [...dueCards, ...newCards].map(toQueueCard),
      // The same parameters the server will schedule with, so the client can
      // run the pure engine locally and agree with it.
      config: {
        params: [...config.params],
        desiredRetention: config.desiredRetention,
        maximumInterval: config.maximumInterval,
        learningSteps: [...config.learningSteps],
        relearningSteps: [...config.relearningSteps],
      },
      dueTotal,
      newRemainingToday: newRemaining,
      reviewRemainingToday: reviewRemaining,
    };
  }

  /**
   * "Why is this card in front of me?"
   *
   * The projected intervals are computed by actually running the scheduler once
   * per button with fuzz switched off, rather than by a second formula written
   * to approximate it. A separate approximation is a second implementation that
   * will drift from the first one.
   */
  async explain(userId: string, cardId: string): Promise<Explanation> {
    const card = await this.prisma.card.findFirst({ where: { id: cardId, userId } });
    if (!card) throw new NotFoundException('That card does not exist, or is not yours.');

    const config = await this.scheduling.forUser(userId);
    const now = new Date();
    const before = toSchedulingCard(card);
    const detail = explainCard(before, now, config);

    const project = (rating: Rating): number => {
      const { card: after } = schedule(before, rating, now, config, 0.5);
      return Math.max(0, (after.dueAt.getTime() - now.getTime()) / DAY_MS);
    };

    return {
      cardId,
      retrievability: detail.retrievability,
      stability: detail.stability,
      difficulty: detail.difficulty,
      elapsedDays: detail.elapsedDays,
      intervalDays: detail.intervalDays,
      predictedForgetAt: detail.predictedForgetAt,
      projectedIntervals: {
        again: project(1),
        hard: project(2),
        good: project(3),
        easy: project(4),
      },
    };
  }

  async history(
    userId: string,
    query: ReviewHistoryQuery,
  ): Promise<{ items: ReviewHistoryItem[]; nextCursor: string | null }> {
    const rows = await this.prisma.review.findMany({
      where: { userId, ...(query.cardId ? { cardId: query.cardId } : {}) },
      orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((r) => ({
        id: r.id,
        cardId: r.cardId,
        rating: r.rating as Rating,
        prevState: r.prevState,
        prevStability: r.prevStability,
        prevDifficulty: r.prevDifficulty,
        newStability: r.newStability,
        newDifficulty: r.newDifficulty,
        elapsedDays: r.elapsedDays,
        scheduledDays: r.scheduledDays,
        retrievability: r.retrievability,
        durationMs: r.durationMs,
        reviewedAt: r.reviewedAt,
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }
}
