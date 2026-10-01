import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Deck as DeckRow, DeckChange as ChangeRow } from '@prisma/client';
import type {
  Deck,
  DeckChange,
  DeckChangeKind,
  DeckChangesPage,
  LibraryDeck,
  LibraryDeckDetail,
  LibraryQuery,
  PageQuery,
  SubscriptionStatus,
  SyncResult,
} from '@recallify/contracts';
import { randomUUID } from 'node:crypto';
import { DecksService, toColor } from '../decks/decks.service';
import { PrismaService } from '../prisma/prisma.service';

const SAMPLE_CARDS = 10;
const DETAIL_CHANGES = 20;
const STATUS_CHANGES = 50;
/** A card's question in the changelog is cut here; a note is stored whole. */
const SUMMARY_MAX = 120;
/** A subscribe or a sync writes a whole deck; a cold database may need a moment. */
const TRANSACTION = { maxWait: 10_000, timeout: 30_000 } as const;

type PublishedRow = DeckRow & {
  user: { displayName: string | null; email: string };
  _count: { cards: number; copies: number };
};

interface SourceText {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  textUpdatedAt: Date;
  suspendedAt: Date | null;
}

/** What a sync would do, as ids and stamps only. Text is fetched for the few cards that need it. */
interface Diff {
  toAdd: string[];
  toEdit: { copyId: string; sourceId: string }[];
  toRemove: { copyId: string; suspended: boolean }[];
}

function summarise(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > SUMMARY_MAX ? `${line.slice(0, SUMMARY_MAX - 1)}…` : line;
}

/**
 * The name beside a published deck. Never the email: its local part is often
 * a real name the person did not choose to publish.
 */
function authorName(user: { displayName: string | null }): string {
  return user.displayName?.trim() || 'Anonymous';
}

function toChange(row: ChangeRow): DeckChange {
  return {
    id: row.id,
    kind: row.kind,
    cardId: row.cardId,
    summary: row.summary,
    createdAt: row.createdAt,
  };
}

/** A copy's card row: the author's text, new state, remembering where it came from. */
function copyCardRow(
  userId: string,
  deckId: string,
  card: SourceText,
  now: Date,
): Prisma.CardCreateManyInput {
  return {
    userId,
    deckId,
    front: card.front,
    back: card.back,
    hint: card.hint,
    source: 'SUBSCRIPTION',
    sourceCardId: card.id,
    sourceUpdatedAt: card.textUpdatedAt,
    // A card the author has set aside arrives set aside. The follower can
    // bring it back; the author's later un-suspension does not reach here.
    suspendedAt: card.suspendedAt ? now : null,
  };
}

const SOURCE_TEXT = {
  id: true,
  front: true,
  back: true,
  hint: true,
  textUpdatedAt: true,
  suspendedAt: true,
} as const;

@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly decks: DecksService,
  ) {}

  // ------------------------------------------------------------- authors

  /**
   * Put a deck in the library.
   *
   * Demo accounts cannot: they are deleted after a day, and a deck that
   * vanishes from under its subscribers is a bad first experience of the
   * feature. Everything else about a demo works.
   */
  async publish(userId: string, deckId: string): Promise<Deck> {
    const [user, deck] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { isDemo: true } }),
      this.prisma.deck.findFirst({
        where: { id: deckId, userId },
        select: { isPublic: true, publishedAt: true, sourceDeckId: true, archivedAt: true },
      }),
    ]);
    if (!deck) throw new NotFoundException('That deck does not exist, or is not yours.');
    if (user.isDemo) {
      throw new ForbiddenException(
        'A demo account cannot publish: it is deleted after a day, and its subscribers would be left with nothing to follow.',
      );
    }
    if (deck.sourceDeckId) {
      throw new BadRequestException(
        'This deck follows someone else’s. Unsubscribe first, then publish it as your own.',
      );
    }
    if (deck.archivedAt) throw new BadRequestException('Restore the deck from the archive first.');

    await this.prisma.deck.update({
      where: { id: deckId, userId },
      data: { isPublic: true, publishedAt: deck.publishedAt ?? new Date() },
    });
    this.logger.log(`deck ${deckId} published by ${userId}`);
    return this.decks.get(userId, deckId);
  }

  /** Out of the library. Existing copies stay with their subscribers and stop receiving changes. */
  async unpublish(userId: string, deckId: string): Promise<Deck> {
    const result = await this.prisma.deck.updateMany({
      where: { id: deckId, userId },
      data: { isPublic: false, publishedAt: null },
    });
    if (result.count === 0) throw new NotFoundException('That deck does not exist, or is not yours.');
    return this.decks.get(userId, deckId);
  }

  /** The "why" beside the changelog's "what". Stored whole: it is the author's own sentence. */
  async addNote(userId: string, deckId: string, text: string): Promise<DeckChange> {
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, userId },
      select: { isPublic: true },
    });
    if (!deck) throw new NotFoundException('That deck does not exist, or is not yours.');
    if (!deck.isPublic) throw new BadRequestException('Notes go on a published deck.');
    const row = await this.prisma.deckChange.create({
      data: { id: randomUUID(), deckId, kind: 'NOTE', summary: text },
    });
    return toChange(row);
  }

  /**
   * Called by the cards module on every write, for every deck, inside the
   * write's own transaction when there is one. One conditional INSERT: it
   * writes a row only when the deck is published, so an unpublished deck
   * pays nothing and the cards module needs no idea whether it is published.
   */
  async recordCardChange(
    input: { deckId: string; kind: DeckChangeKind; cardId: string | null; summary: string },
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO "deck_changes" ("id", "deckId", "kind", "cardId", "summary", "createdAt")
      SELECT ${randomUUID()}, d."id", ${input.kind}::"DeckChangeKind", ${input.cardId}, ${summarise(input.summary)}, now()
      FROM "decks" d
      WHERE d."id" = ${input.deckId} AND d."isPublic" = true
    `;
  }

  // ------------------------------------------------------------- the library

  private async subscribedCopies(userId: string, sourceIds: string[]): Promise<Map<string, string>> {
    if (sourceIds.length === 0) return new Map();
    const copies = await this.prisma.deck.findMany({
      where: { userId, sourceDeckId: { in: sourceIds } },
      select: { id: true, sourceDeckId: true },
    });
    return new Map(copies.map((c) => [c.sourceDeckId as string, c.id]));
  }

  private async latestChangeAt(deckIds: string[]): Promise<Map<string, Date>> {
    if (deckIds.length === 0) return new Map();
    const rows = await this.prisma.deckChange.groupBy({
      by: ['deckId'],
      where: { deckId: { in: deckIds } },
      _max: { createdAt: true },
    });
    return new Map(rows.flatMap((r) => (r._max.createdAt ? [[r.deckId, r._max.createdAt]] : [])));
  }

  private toLibraryDeck(
    row: PublishedRow,
    userId: string,
    copies: Map<string, string>,
    latest: Map<string, Date>,
  ): LibraryDeck {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      color: toColor(row.color),
      authorName: authorName(row.user),
      cardCount: row._count.cards,
      subscriberCount: row._count.copies,
      publishedAt: row.publishedAt,
      updatedAt: latest.get(row.id) ?? row.publishedAt ?? row.updatedAt,
      isMine: row.userId === userId,
      subscribedDeckId: copies.get(row.id) ?? null,
    };
  }

  private readonly publishedInclude = {
    user: { select: { displayName: true, email: true } },
    _count: { select: { cards: true, copies: true } },
  } as const;

  async list(
    userId: string,
    query: LibraryQuery,
  ): Promise<{ items: LibraryDeck[]; nextCursor: string | null }> {
    const rows = await this.prisma.deck.findMany({
      where: {
        isPublic: true,
        archivedAt: null,
        ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: this.publishedInclude,
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const ids = page.map((r) => r.id);
    const [copies, latest] = await Promise.all([
      this.subscribedCopies(userId, ids),
      this.latestChangeAt(ids),
    ]);
    return {
      items: page.map((row) => this.toLibraryDeck(row, userId, copies, latest)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  /** Visible to everyone while published and not archived, and to its author always. */
  private async publishedOrMine(userId: string, deckId: string): Promise<PublishedRow> {
    const row = await this.prisma.deck.findFirst({
      where: { id: deckId, OR: [{ isPublic: true, archivedAt: null }, { userId }] },
      include: this.publishedInclude,
    });
    if (!row) throw new NotFoundException('That deck is not in the library.');
    return row;
  }

  async detail(userId: string, deckId: string): Promise<LibraryDeckDetail> {
    const row = await this.publishedOrMine(userId, deckId);
    const [copies, latest, sample, changes] = await Promise.all([
      this.subscribedCopies(userId, [row.id]),
      this.latestChangeAt([row.id]),
      this.prisma.card.findMany({
        where: { deckId: row.id },
        orderBy: { createdAt: 'asc' },
        take: SAMPLE_CARDS,
        select: { front: true, back: true },
      }),
      this.prisma.deckChange.findMany({
        where: { deckId: row.id },
        orderBy: { createdAt: 'desc' },
        take: DETAIL_CHANGES,
      }),
    ]);
    return {
      ...this.toLibraryDeck(row, userId, copies, latest),
      sampleCards: sample,
      changes: changes.map(toChange),
    };
  }

  async changes(userId: string, deckId: string, query: PageQuery): Promise<DeckChangesPage> {
    await this.publishedOrMine(userId, deckId);
    const rows = await this.prisma.deckChange.findMany({
      where: { deckId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(toChange),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  // ------------------------------------------------------------- subscribers

  /**
   * A copy of a published deck, every card new.
   *
   * The copy is the subscriber's own deck in every respect: reviewed,
   * scheduled and logged like any other. What makes it a subscription is
   * that each card remembers which of the author's cards it came from, so a
   * later sync can find it.
   */
  async subscribe(userId: string, sourceDeckId: string): Promise<Deck> {
    const source = await this.prisma.deck.findFirst({
      where: { id: sourceDeckId, isPublic: true, archivedAt: null },
      include: { cards: { select: SOURCE_TEXT } },
    });
    if (!source) throw new NotFoundException('That deck is not in the library.');
    if (source.userId === userId) {
      throw new BadRequestException(
        'This is your own deck. Subscribing to it would give you a second copy of your own cards.',
      );
    }

    try {
      const copy = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const deck = await tx.deck.create({
          data: {
            userId,
            title: source.title,
            description: source.description,
            color: source.color,
            sourceDeckId: source.id,
            syncedAt: now,
          },
          select: { id: true },
        });
        if (source.cards.length > 0) {
          await tx.card.createMany({
            data: source.cards.map((card) => copyCardRow(userId, deck.id, card, now)),
          });
        }
        return deck;
      }, TRANSACTION);
      this.logger.log(`${userId} subscribed to deck ${sourceDeckId}, ${source.cards.length} cards`);
      return this.decks.get(userId, copy.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You already follow this deck.');
      }
      throw error;
    }
  }

  /** Detach. The deck and every card and review in it stay exactly as they are. */
  async unsubscribe(userId: string, deckId: string): Promise<Deck> {
    const copy = await this.copyOf(userId, deckId);
    await this.prisma.$transaction([
      this.prisma.deck.update({
        where: { id: copy.id, userId },
        data: { sourceDeckId: null, syncedAt: null },
      }),
      this.prisma.card.updateMany({
        where: { deckId: copy.id, userId },
        data: { sourceCardId: null, sourceUpdatedAt: null },
      }),
    ]);
    return this.decks.get(userId, deckId);
  }

  private async copyOf(
    userId: string,
    deckId: string,
  ): Promise<{ id: string; sourceDeckId: string; syncedAt: Date | null }> {
    const copy = await this.prisma.deck.findFirst({
      where: { id: deckId, userId },
      select: { id: true, sourceDeckId: true, syncedAt: true },
    });
    if (!copy) throw new NotFoundException('That deck does not exist, or is not yours.');
    if (!copy.sourceDeckId) throw new BadRequestException('This deck does not follow another.');
    return { id: copy.id, sourceDeckId: copy.sourceDeckId, syncedAt: copy.syncedAt };
  }

  /**
   * What a sync would do, from ids and stamps alone.
   *
   * Matched by the source card's id, never by text. A card whose text the
   * author has changed since the copy last took it is an edit; one the copy
   * does not have is an addition; one the author has deleted is a removal.
   * A subscriber's own edit to a copied card survives until the author next
   * edits that card, at which point the author's text wins: the deck is
   * theirs to maintain, and that is the point of following it. Because the
   * comparison is on `textUpdatedAt`, an author who only studies their deck
   * changes nothing here.
   */
  private async diff(copyDeckId: string, sourceDeckId: string): Promise<Diff> {
    const [sourceCards, copyCards] = await Promise.all([
      this.prisma.card.findMany({
        where: { deckId: sourceDeckId },
        select: { id: true, textUpdatedAt: true },
      }),
      this.prisma.card.findMany({
        where: { deckId: copyDeckId, sourceCardId: { not: null } },
        select: { id: true, sourceCardId: true, sourceUpdatedAt: true, suspendedAt: true },
      }),
    ]);
    const bySource = new Map(copyCards.map((c) => [c.sourceCardId as string, c]));
    const sourceIds = new Set(sourceCards.map((c) => c.id));

    const toAdd: string[] = [];
    const toEdit: Diff['toEdit'] = [];
    for (const source of sourceCards) {
      const copy = bySource.get(source.id);
      if (!copy) toAdd.push(source.id);
      else if (!copy.sourceUpdatedAt || source.textUpdatedAt > copy.sourceUpdatedAt) {
        toEdit.push({ copyId: copy.id, sourceId: source.id });
      }
    }
    const toRemove = copyCards
      .filter((c) => !sourceIds.has(c.sourceCardId as string))
      .map((c) => ({ copyId: c.id, suspended: c.suspendedAt !== null }));
    return { toAdd, toEdit, toRemove };
  }

  async status(userId: string, deckId: string): Promise<SubscriptionStatus> {
    const copy = await this.copyOf(userId, deckId);
    const source = await this.prisma.deck.findFirst({
      where: { id: copy.sourceDeckId, isPublic: true, archivedAt: null },
      include: this.publishedInclude,
    });
    if (!source) {
      return {
        deckId,
        source: null,
        syncedAt: copy.syncedAt,
        pending: { added: 0, edited: 0, removed: 0 },
        changes: [],
      };
    }
    const [diff, latest, changes] = await Promise.all([
      this.diff(copy.id, source.id),
      this.latestChangeAt([source.id]),
      this.prisma.deckChange.findMany({
        where: { deckId: source.id, ...(copy.syncedAt ? { createdAt: { gt: copy.syncedAt } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: STATUS_CHANGES,
      }),
    ]);
    return {
      deckId,
      source: this.toLibraryDeck(source, userId, new Map([[source.id, deckId]]), latest),
      syncedAt: copy.syncedAt,
      pending: {
        added: diff.toAdd.length,
        edited: diff.toEdit.length,
        removed: diff.toRemove.filter((r) => !r.suspended).length,
      },
      changes: changes.map(toChange),
    };
  }

  /**
   * Bring the copy up to date with its source, in one transaction.
   *
   * Text only. State, stability, difficulty, due date and the review log of
   * every card in the copy are not read here, let alone written. A removed
   * card is suspended, which keeps its history and takes it out of the
   * queue, and detached, so it is the follower's own from then on: if they
   * bring it back, no later sync suspends it again. Two syncs racing cannot
   * add a card twice; the copy's (deck, source card) pair is unique.
   */
  async sync(userId: string, deckId: string): Promise<SyncResult> {
    const copy = await this.copyOf(userId, deckId);
    const source = await this.prisma.deck.findFirst({
      where: { id: copy.sourceDeckId, isPublic: true, archivedAt: null },
      select: { id: true },
    });
    if (!source) {
      throw new NotFoundException(
        'The author has taken this deck out of the library. Your copy stays exactly as it is.',
      );
    }
    const diff = await this.diff(copy.id, source.id);
    const now = new Date();

    // Text for the cards that need it, and nothing for the rest of the deck.
    const wanted = [...diff.toAdd, ...diff.toEdit.map((e) => e.sourceId)];
    const [sourceText, copyText] = await Promise.all([
      wanted.length > 0
        ? this.prisma.card.findMany({ where: { id: { in: wanted } }, select: SOURCE_TEXT })
        : [],
      diff.toEdit.length > 0
        ? this.prisma.card.findMany({
            where: { id: { in: diff.toEdit.map((e) => e.copyId) }, userId },
            select: { id: true, front: true, back: true, hint: true },
          })
        : [],
    ]);
    const sourceById = new Map(sourceText.map((c) => [c.id, c]));
    const copyById = new Map(copyText.map((c) => [c.id, c]));

    const additions = diff.toAdd.flatMap((id) => {
      const card = sourceById.get(id);
      return card ? [copyCardRow(userId, copy.id, card, now)] : [];
    });
    const edits = diff.toEdit.flatMap(({ copyId, sourceId }) => {
      const from = sourceById.get(sourceId);
      const to = copyById.get(copyId);
      if (!from || !to) return [];
      const changed = to.front !== from.front || to.back !== from.back || to.hint !== from.hint;
      return [{ copyId, from, changed }];
    });
    const toSuspend = diff.toRemove.filter((r) => !r.suspended).map((r) => r.copyId);

    const added = await this.prisma.$transaction(async (tx) => {
      let count = 0;
      if (additions.length > 0) {
        ({ count } = await tx.card.createMany({ data: additions, skipDuplicates: true }));
      }
      for (const edit of edits) {
        await tx.card.update({
          where: { id: edit.copyId, userId },
          data: {
            front: edit.from.front,
            back: edit.from.back,
            hint: edit.from.hint,
            sourceUpdatedAt: edit.from.textUpdatedAt,
            ...(edit.changed ? { textUpdatedAt: now } : {}),
          },
        });
      }
      if (toSuspend.length > 0) {
        await tx.card.updateMany({
          where: { id: { in: toSuspend }, userId },
          data: { suspendedAt: now },
        });
      }
      if (diff.toRemove.length > 0) {
        await tx.card.updateMany({
          where: { id: { in: diff.toRemove.map((r) => r.copyId) }, userId },
          data: { sourceCardId: null, sourceUpdatedAt: null },
        });
      }
      await tx.deck.update({ where: { id: copy.id, userId }, data: { syncedAt: now } });
      return count;
    }, TRANSACTION);

    const edited = edits.filter((e) => e.changed).length;
    this.logger.log(`synced deck ${copy.id}: +${added} ~${edited} -${toSuspend.length}`);
    return { added, edited, removed: toSuspend.length, syncedAt: now };
  }
}
