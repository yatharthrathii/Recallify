import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ImportCard, ImportRequest, ImportResponse } from '@recallify/contracts';
import { newCard, schedule, type FsrsConfig } from '@recallify/fsrs';
import { newCardId, reviewIdFor } from '../common/ids';
import { DecksService } from '../decks/decks.service';
import { LibraryService } from '../library/library.service';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsConfigService } from '../scheduling/fsrs-config.service';
import { MAX_CLOCK_SKEW_MS, reviewLogColumns } from '../scheduling/review-row';
import { StatsService } from '../stats/stats.service';

interface ReplayedCard {
  readonly card: Prisma.CardCreateManyInput & { id: string };
  readonly reviews: readonly Prisma.ReviewCreateManyInput[];
}

/**
 * Replay one imported card's history through the scheduler.
 *
 * The result is what the card would look like had every one of those answers
 * been given here: a review row per answer, carrying the before and after
 * state so the log stays replayable, and the card row with the final state.
 * Fuzz is off (random 0.5), so an import is reproducible. The card's id is
 * made here so its reviews can name it before anything is written.
 */
function replayCard(
  userId: string,
  deckId: string,
  input: ImportCard,
  config: FsrsConfig,
  now: Date,
): ReplayedCard {
  const cardId = newCardId();
  const ceiling = new Date(now.getTime() + MAX_CLOCK_SKEW_MS);
  const ordered = [...input.reviews].sort(
    (a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime(),
  );

  const first = ordered[0];
  const createdAt = first ? new Date(Math.min(first.reviewedAt.getTime(), now.getTime())) : now;
  let card = newCard(createdAt);
  let last: Date | null = null;
  const reviews: Prisma.ReviewCreateManyInput[] = [];

  for (const review of ordered) {
    // Never in the future, never before the previous answer.
    let at = review.reviewedAt > ceiling ? now : review.reviewedAt;
    if (last && at < last) at = last;
    last = at;

    const { card: after, log } = schedule(card, review.rating, at, config, 0.5);
    reviews.push({
      id: reviewIdFor(userId, review.id),
      cardId,
      userId,
      rating: review.rating,
      ...reviewLogColumns(log, after, at),
      durationMs: review.durationMs ?? null,
      reviewedAt: at,
      syncedAt: now,
    });
    card = after;
  }

  return {
    card: {
      id: cardId,
      userId,
      deckId,
      front: input.front,
      back: input.back,
      hint: input.hint || null,
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
      textUpdatedAt: createdAt,
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
    private readonly library: LibraryService,
  ) {}

  /**
   * One request of an import, as one transaction: the deck if it is new, the
   * cards, their reviews, the stats they earn and the changelog line, or none
   * of it.
   *
   * A review id that already exists fails the whole request with 409. The ids
   * are derived from the source file and this account, so this is what "you
   * imported this already" looks like, and stopping is right: the alternative
   * is a person's history counted twice. Another account importing the same
   * file gets its own ids and is not affected.
   */
  async importCards(userId: string, input: ImportRequest, now = new Date()): Promise<ImportResponse> {
    if (input.deckId) await this.decks.assertOwned(userId, input.deckId);
    else if (!input.newDeck) throw new BadRequestException('Provide either deckId or newDeck.');
    const newDeck = input.newDeck;
    const config = await this.scheduling.forUser(userId);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const deckId = input.deckId ?? (await this.decks.create(userId, newDeck!, tx)).id;
          const replayed = input.cards.map((card) => replayCard(userId, deckId, card, config, now));

          await tx.card.createMany({ data: replayed.map((r) => r.card) });
          // Prisma splits a large createMany by the bind-parameter limit itself.
          const rows = replayed.flatMap((r) => r.reviews);
          if (rows.length > 0) {
            await tx.review.createMany({ data: rows });
            await this.stats.absorbHistory(tx, userId, rows.length, now);
          }
          if (input.deckId) {
            await this.library.recordCardChange(
              { deckId, kind: 'ADDED', cardId: null, summary: `${replayed.length} cards added` },
              tx,
            );
          }

          this.logger.log(
            `imported ${replayed.length} cards and ${rows.length} reviews for ${userId}`,
          );
          return { deckId, cardsCreated: replayed.length, reviewsCreated: rows.length };
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
