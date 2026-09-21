import { Injectable, NotFoundException } from '@nestjs/common';
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
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly decks: DecksService,
  ) {}

  private toCard(row: CardRow): Card {
    return {
      id: row.id,
      deckId: row.deckId,
      front: row.front,
      back: row.back,
      hint: row.hint,
      source: row.source,
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

  async create(userId: string, input: CreateCardRequest): Promise<Card> {
    await this.decks.assertOwned(userId, input.deckId);

    const row = await this.prisma.card.create({
      data: {
        userId,
        deckId: input.deckId,
        front: input.front,
        back: input.back,
        hint: input.hint ?? null,
      },
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

    const result = await this.prisma.card.createMany({
      data: input.cards.map((c) => ({
        userId,
        deckId: input.deckId,
        source: input.source,
        front: c.front,
        back: c.back,
        hint: c.hint ?? null,
      })),
    });

    return { deckId: input.deckId, created: result.count };
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
   */
  async update(userId: string, id: string, input: UpdateCardRequest): Promise<Card> {
    const row = await this.prisma.card.update({
      where: { id, userId },
      data: {
        ...(input.front !== undefined ? { front: input.front } : {}),
        ...(input.back !== undefined ? { back: input.back } : {}),
        // Clearing the field means "no hint", which is null, not ''.
        ...(input.hint !== undefined ? { hint: input.hint === '' ? null : input.hint } : {}),
      },
    });
    return this.toCard(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.card.delete({ where: { id, userId } });
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
