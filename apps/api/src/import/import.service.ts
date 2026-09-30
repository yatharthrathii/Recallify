import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ImportCard, ImportRequest, ImportResponse } from '@recallify/contracts';
import { DAY_MS, newCard, schedule, type FsrsConfig, type Rating } from '@recallify/fsrs';
import { DecksService } from '../decks/decks.service';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsConfigService } from '../scheduling/fsrs-config.service';
import { StatsService } from '../stats/stats.service';

/** Same allowance as a live review: a device clock a little ahead is not a lie. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

/** Rows per INSERT. Under Postgres's parameter limit with room to spare. */
const INSERT_BATCH = 2000;

type ReviewRow = Omit<Prisma.ReviewCreateManyInput, 'cardId'>;

interface ReplayedCard {
  readonly card: Prisma.CardCreateManyInput;
  readonly reviews: readonly ReviewRow[];
}

/**
 * Replay one imported card's history through the scheduler.
 *
 * The result is what the card would look like had every one of those answers
 * been given here: a review row per answer, carrying the before and after
 * state so the log stays replayable, and the card row with the final state.
 * Fuzz is off (random 0.5), so an import is reproducible.
 */
function replayCard(
  userId: string,
  deckId: string,
  input: ImportCard,
  config: FsrsConfig,
  now: Date,
): ReplayedCard {
  const ceiling = new Date(now.getTime() + MAX_CLOCK_SKEW_MS);
  const ordered = [...input.reviews].sort(
    (a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime(),
  );

  const first = ordered[0];
  const createdAt = first ? new Date(Math.min(first.reviewedAt.getTime(), now.getTime())) : now;
  let card = newCard(createdAt);
  let last: Date | null = null;
  const reviews: ReviewRow[] = [];

  for (const review of ordered) {
    // Never in the future, never before the previous answer.
    let at = review.reviewedAt > ceiling ? now : review.reviewedAt;
    if (last && at < last) at = last;
    last = at;

    const { card: after, log } = schedule(card, review.rating as Rating, at, config, 0.5);
    reviews.push({
      id: review.id,
      userId,
      rating: review.rating,
      prevState: log.prevState,
      prevStability: log.prevStability,
      prevDifficulty: log.prevDifficulty,
      newStability: log.newStability,
      newDifficulty: log.newDifficulty,
      scheduledDays: Math.max(0, Math.round((after.dueAt.getTime() - at.getTime()) / DAY_MS)),
      elapsedDays: Math.round(log.elapsedDays),
      retrievability: log.retrievability,
      durationMs: review.durationMs ?? null,
      reviewedAt: at,
      syncedAt: now,
    });
    card = after;
  }

  return {
    card: {
      userId,
      deckId,
      front: input.front,
      back: input.back,
      hint: input.hint ?? null,
      source: 'IMPORT',
      state: card.state,
      stability: card.stability,
      difficulty: card.difficulty,
      dueAt: card.dueAt,
      reps: card.reps,
      lapses: card.lapses,
      lastReviewedAt: card.lastReviewedAt,
      learningStep: card.learningStep,
      suspendedAt: input.suspended ? now : null,
      createdAt,
    },
    reviews,
  };
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly decks: DecksService,
    private readonly scheduling: FsrsConfigService,
    private readonly stats: StatsService,
  ) {}

  /**
   * One request of an import, as one transaction: the deck if it is new, the
   * cards, their reviews, and the stats they earn, or none of it.
   *
   * A review id that already exists fails the whole request with 409. The ids
   * are derived from the source file, so this is what "you imported this
   * already" looks like, and stopping is right: the alternative is a person's
   * history counted twice.
   */
  async importCards(userId: string, input: ImportRequest, now = new Date()): Promise<ImportResponse> {
    if (input.deckId) await this.decks.assertOwned(userId, input.deckId);
    const config = await this.scheduling.forUser(userId);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const deckId = input.deckId ?? (await this.decks.create(userId, input.newDeck!, tx)).id;
          const replayed = input.cards.map((card) => replayCard(userId, deckId, card, config, now));

          const created = await tx.card.createManyAndReturn({
            data: replayed.map((r) => r.card),
            select: { id: true },
          });

          const rows: Prisma.ReviewCreateManyInput[] = replayed.flatMap((r, i) =>
            r.reviews.map((review) => ({ ...review, cardId: created[i]!.id })),
          );
          for (let at = 0; at < rows.length; at += INSERT_BATCH) {
            await tx.review.createMany({ data: rows.slice(at, at + INSERT_BATCH) });
          }
          if (rows.length > 0) await this.stats.absorbHistory(tx, userId, rows.length, now);

          this.logger.log(
            `imported ${created.length} cards and ${rows.length} reviews for ${userId}`,
          );
          return { deckId, cardsCreated: created.length, reviewsCreated: rows.length };
        },
        // Several thousand rows on a database that may be waking up.
        { maxWait: 10_000, timeout: 60_000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Some of these reviews are already in your account, so this file, or this part of it, was imported before. Nothing was added.',
        );
      }
      throw error;
    }
  }
}
