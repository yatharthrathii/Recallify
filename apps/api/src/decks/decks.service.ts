import { Injectable, NotFoundException } from '@nestjs/common';
import type { Deck as DeckRow, Prisma } from '@prisma/client';
import type {
  CreateDeckRequest,
  Deck,
  DeckColor,
  DeckStats,
  ListDecksQuery,
  UpdateDeckRequest,
} from '@recallify/contracts';
import { deckColor } from '@recallify/contracts';
import { addDays, dayKey, instantOf, keyOfDay, localDay } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsConfigService } from '../scheduling/fsrs-config.service';
import { meanRetrievability } from '../scheduling/recall';

const FORECAST_DAYS = 30;

/** Prisma stores the colour as text; narrow it back rather than casting. */
export function toColor(value: string): DeckColor {
  const parsed = deckColor.safeParse(value);
  return parsed.success ? parsed.data : 'amber';
}

@Injectable()
export class DecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: FsrsConfigService,
  ) {}

  private toDeck(
    row: DeckRow,
    cardCount: number,
    dueCount: number,
    subscriberCount = 0,
  ): Deck {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      color: toColor(row.color),
      isPublic: row.isPublic,
      archivedAt: row.archivedAt,
      cardCount,
      dueCount,
      publishedAt: row.publishedAt,
      subscriberCount,
      sourceDeckId: row.sourceDeckId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Due counts for several decks in one query.
   *
   * The obvious version asks per deck, which is N+1 -- twenty decks on the home
   * screen would be twenty-one round trips to a database that sleeps between
   * requests on the free tier.
   */
  private async dueCounts(userId: string, deckIds: string[]): Promise<Map<string, number>> {
    if (deckIds.length === 0) return new Map();

    const groups = await this.prisma.card.groupBy({
      by: ['deckId'],
      where: {
        userId,
        deckId: { in: deckIds },
        suspendedAt: null,
        dueAt: { lte: new Date() },
      },
      _count: { _all: true },
    });

    return new Map(groups.map((g) => [g.deckId, g._count._all]));
  }

  /** How many copies each published deck has, in one query. Zero for the rest. */
  private async subscriberCounts(deckIds: string[]): Promise<Map<string, number>> {
    if (deckIds.length === 0) return new Map();
    const groups = await this.prisma.deck.groupBy({
      by: ['sourceDeckId'],
      where: { sourceDeckId: { in: deckIds } },
      _count: { _all: true },
    });
    return new Map(groups.map((g) => [g.sourceDeckId as string, g._count._all]));
  }

  async list(
    userId: string,
    query: ListDecksQuery,
  ): Promise<{ items: Deck[]; nextCursor: string | null }> {
    const rows = await this.prisma.deck.findMany({
      // Ownership is part of the filter, never a check applied afterwards.
      where: { userId, ...(query.includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      // One extra row is how we know whether another page exists, without a
      // second COUNT over the whole table.
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: { _count: { select: { cards: true } } },
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const ids = page.map((d) => d.id);
    const [due, subscribers] = await Promise.all([
      this.dueCounts(userId, ids),
      this.subscriberCounts(page.filter((d) => d.isPublic).map((d) => d.id)),
    ]);

    return {
      items: page.map((d) =>
        this.toDeck(d, d._count.cards, due.get(d.id) ?? 0, subscribers.get(d.id) ?? 0),
      ),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * Confirm a deck is this user's, for the modules that write into it.
   *
   * Cards and reviews need the check but must not query the deck table
   * themselves -- the module that owns a table is the only one that reads it,
   * which is the line that keeps "modular monolith" from being decoration.
   */
  async assertOwned(userId: string, deckId: string): Promise<void> {
    const found = await this.prisma.deck.findFirst({
      where: { id: deckId, userId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('That deck does not exist, or is not yours.');
  }

  /**
   * `tx` lets the importer make the deck in the same transaction as the cards
   * it is about to put in it, so a failed import leaves no empty deck behind.
   */
  async create(
    userId: string,
    input: CreateDeckRequest,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Deck> {
    const row = await tx.deck.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        color: input.color,
      },
    });
    return this.toDeck(row, 0, 0);
  }

  async get(userId: string, id: string): Promise<Deck> {
    const row = await this.prisma.deck.findFirst({
      where: { id, userId },
      include: { _count: { select: { cards: true } } },
    });
    if (!row) throw new NotFoundException('That deck does not exist, or is not yours.');

    const [due, subscribers] = await Promise.all([
      this.dueCounts(userId, [id]),
      this.subscriberCounts(row.isPublic ? [id] : []),
    ]);
    return this.toDeck(row, row._count.cards, due.get(id) ?? 0, subscribers.get(id) ?? 0);
  }

  /**
   * Archiving also takes a deck out of the library: a deck its author has
   * put away should not be found, followed or synced from. Restoring does not
   * republish; that is the author's call to make again.
   */
  async update(userId: string, id: string, input: UpdateDeckRequest): Promise<Deck> {
    const { archived, ...fields } = input;

    // `userId` sits in the where clause, so another user's id simply matches
    // nothing and Prisma raises P2025 -- which the problem filter turns into a
    // 404. There is no window where the row is loaded, checked, then written.
    await this.prisma.deck.update({
      where: { id, userId },
      data: {
        ...(fields.title !== undefined ? { title: fields.title } : {}),
        ...(fields.description !== undefined ? { description: fields.description } : {}),
        ...(fields.color !== undefined ? { color: fields.color } : {}),
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
        ...(archived ? { isPublic: false, publishedAt: null } : {}),
      },
    });

    return this.get(userId, id);
  }

  /**
   * Hard delete, cascading to the deck's cards and their reviews.
   *
   * "Review is append-only" means the app never rewrites history behind the
   * user's back; it does not mean the user may never erase their own data.
   * Archiving is the reversible path and the one the UI offers first -- this is
   * the one that actually removes it.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction([
      // Copies of a published deck are detached, not deleted: the foreign key
      // clears their sourceDeckId, and this clears what their cards pointed at.
      this.prisma.card.updateMany({
        where: { deck: { sourceDeckId: id }, sourceCardId: { not: null } },
        data: { sourceCardId: null, sourceUpdatedAt: null },
      }),
      this.prisma.deck.delete({ where: { id, userId } }),
    ]);
  }

  async stats(userId: string, deckId: string): Promise<DeckStats> {
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, userId },
      select: { id: true },
    });
    if (!deck) throw new NotFoundException('That deck does not exist, or is not yours.');

    const config = await this.scheduling.forUser(userId);

    // Four columns per card, not the whole row: the fronts and backs of a
    // thousand-card deck are megabytes this endpoint has no use for.
    const cards = await this.prisma.card.findMany({
      where: { deckId, userId, suspendedAt: null },
      select: { state: true, stability: true, dueAt: true, lastReviewedAt: true },
    });

    const now = new Date();
    const today = localDay(now, config.timezone);
    const todayStart = instantOf(today, config.timezone);

    const counts = { NEW: 0, LEARNING: 0, REVIEW: 0, RELEARNING: 0 };
    const dueByDay = new Map<string, number>();
    let dueNow = 0;
    let seenCards = 0;
    let stabilitySum = 0;

    for (const card of cards) {
      counts[card.state] += 1;

      if (card.dueAt <= now) dueNow += 1;

      // Overdue cards land on today rather than in the past, which is where
      // they actually have to be answered.
      const key = dayKey(card.dueAt < todayStart ? now : card.dueAt, config.timezone);
      dueByDay.set(key, (dueByDay.get(key) ?? 0) + 1);

      // A NEW card has no memory to measure; it is left out of the mean.
      if (card.state !== 'NEW' && card.lastReviewedAt) {
        seenCards += 1;
        stabilitySum += card.stability;
      }
    }
    const seen = cards.filter((c) => c.state !== 'NEW');

    const forecast = Array.from({ length: FORECAST_DAYS }, (_, i) => {
      const date = keyOfDay(addDays(today, i));
      return { date, due: dueByDay.get(date) ?? 0 };
    });

    return {
      deckId,
      total: cards.length,
      newCards: counts.NEW,
      learning: counts.LEARNING,
      review: counts.REVIEW,
      relearning: counts.RELEARNING,
      dueNow,
      averageRetrievability: meanRetrievability(config.params, seen, now) ?? 0,
      averageStabilityDays: seenCards > 0 ? stabilitySum / seenCards : 0,
      forecast,
    };
  }
}
