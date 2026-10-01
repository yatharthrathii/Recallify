import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Card as CardRow } from '@prisma/client';
import type {
  BulkCreateRequest,
  BulkCreateResponse,
  Card,
  CreateCardRequest,
  ListCardsQuery,
  UpdateCardRequest,
} from '@recallify/contracts';
import { DecksService } from '../decks/decks.service';
import { LibraryService } from '../library/library.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly decks: DecksService,
    private readonly library: LibraryService,
  ) {}

  private toCard(row: CardRow): Card {
    return {
      id: row.id,
      deckId: row.deckId,
      front: row.front,
      back: row.back,
      hint: row.hint,
      source: row.source,
      sourceCardId: row.sourceCardId,
      suspendedAt: row.suspendedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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

  async list(
    userId: string,
    query: ListCardsQuery,
  ): Promise<{ items: Card[]; nextCursor: string | null }> {
    const rows = await this.prisma.card.findMany({
      where: {
        userId,
        ...(query.deckId ? { deckId: query.deckId } : {}),
        ...(query.includeSuspended ? {} : { suspendedAt: null }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((c) => this.toCard(c)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * Every write here lands together with its changelog line, or not at all:
   * a card created and a changelog that failed would make a retry create it
   * twice. The line is recorded only if the deck is published; see
   * LibraryService.
   */
  async create(userId: string, input: CreateCardRequest): Promise<Card> {
    await this.decks.assertOwned(userId, input.deckId);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.card.create({
        data: {
          userId,
          deckId: input.deckId,
          front: input.front,
          back: input.back,
          hint: input.hint || null,
        },
      });
      await this.library.recordCardChange(
        { deckId: created.deckId, kind: 'ADDED', cardId: created.id, summary: created.front },
        tx,
      );
      return created;
    });
    return this.toCard(row);
  }

  /**
   * The path AI generation and .apkg import both land on.
   *
   * `createMany` is one INSERT with many rows rather than one per card: five
   * hundred round trips would take long enough to time out, and each would be
   * its own transaction, so a failure halfway would leave a partial deck.
   */
  async bulkCreate(userId: string, input: BulkCreateRequest): Promise<BulkCreateResponse> {
    await this.decks.assertOwned(userId, input.deckId);

    const created = await this.prisma.$transaction(async (tx) => {
      const result = await tx.card.createMany({
        data: input.cards.map((c) => ({
          userId,
          deckId: input.deckId,
          source: input.source,
          front: c.front,
          back: c.back,
          hint: c.hint || null,
        })),
      });
      await this.library.recordCardChange(
        { deckId: input.deckId, kind: 'ADDED', cardId: null, summary: `${result.count} cards added` },
        tx,
      );
      return result.count;
    });
    return { deckId: input.deckId, created };
  }

  async get(userId: string, id: string): Promise<Card> {
    const row = await this.prisma.card.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('That card does not exist, or is not yours.');
    return this.toCard(row);
  }

  /**
   * Editing the text never touches the scheduling state.
   *
   * Fixing a typo on a card you have known for six months must not send it back
   * to the start -- the memory is of the idea, not of the wording. Anki makes
   * the same choice, and it is the reason `state`, `stability` and `dueAt` are
   * absent from `updateCardRequest` rather than merely ignored here.
   *
   * A save that changes nothing is not an edit: no stamp moves, no changelog
   * line, and no follower's copy is touched by it.
   */
  async update(userId: string, id: string, input: UpdateCardRequest): Promise<Card> {
    const current = await this.prisma.card.findFirst({ where: { id, userId } });
    if (!current) throw new NotFoundException('That card does not exist, or is not yours.');

    const next = {
      front: input.front ?? current.front,
      back: input.back ?? current.back,
      // Clearing the field means "no hint", which is null, not ''.
      hint: input.hint === undefined ? current.hint : input.hint || null,
    };
    const changed =
      next.front !== current.front || next.back !== current.back || next.hint !== current.hint;
    if (!changed) return this.toCard(current);

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.card.update({
        where: { id, userId },
        data: { ...next, textUpdatedAt: new Date() },
      });
      await this.library.recordCardChange(
        { deckId: updated.deckId, kind: 'EDITED', cardId: updated.id, summary: updated.front },
        tx,
      );
      return updated;
    });
    return this.toCard(row);
  }

  /**
   * The question is read before the row goes, because it is what the
   * changelog can still say about a card that no longer exists.
   *
   * A card in a followed deck is not deleted: the next update would bring
   * it straight back, since the copy mirrors the author's cards. Suspending
   * keeps it out of the queue; unfollowing makes every card the follower's
   * own to delete.
   */
  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.card.findFirst({
      where: { id, userId },
      select: { id: true, deckId: true, front: true, sourceCardId: true },
    });
    if (!row) throw new NotFoundException('That card does not exist, or is not yours.');
    if (row.sourceCardId) {
      throw new ConflictException(
        'This card follows the author’s. Suspend it to keep it out of your reviews, or stop following the deck to delete it.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.card.delete({ where: { id, userId }, select: { id: true } });
      await this.library.recordCardChange(
        { deckId: row.deckId, kind: 'REMOVED', cardId: row.id, summary: row.front },
        tx,
      );
    });
  }

  /** Out of the queue, but the state and the history stay exactly as they are. */
  async setSuspended(userId: string, id: string, suspended: boolean): Promise<Card> {
    const row = await this.prisma.card.update({
      where: { id, userId },
      data: { suspendedAt: suspended ? new Date() : null },
    });
    return this.toCard(row);
  }
}
