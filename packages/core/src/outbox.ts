import type { Rating } from '@recallify/fsrs';

/**
 * Reviews that have been answered but not yet accepted by the server.
 *
 * Pure data and pure functions: where it is kept is the platform's business
 * (localStorage on web, SQLite on the phone). Every entry carries the id it was
 * created with, and that id is the review's primary key on the server, so
 * sending an entry twice is harmless. That is what makes "retry everything that
 * is still here" a safe strategy rather than a risky one.
 */
export interface PendingReview {
  readonly id: string;
  readonly cardId: string;
  readonly rating: Rating;
  /** ISO string, so the entry survives JSON storage unchanged. */
  readonly reviewedAt: string;
  /** How long the card was on screen. For the stats page only. */
  readonly durationMs?: number;
}

export function enqueue(outbox: readonly PendingReview[], entry: PendingReview): PendingReview[] {
  return outbox.some((e) => e.id === entry.id) ? [...outbox] : [...outbox, entry];
}

export function acknowledge(
  outbox: readonly PendingReview[],
  acceptedIds: readonly string[],
): PendingReview[] {
  const accepted = new Set(acceptedIds);
  return outbox.filter((e) => !accepted.has(e.id));
}

/** The server takes at most 200 reviews per batch. */
export function nextBatch(outbox: readonly PendingReview[], size = 200): PendingReview[] {
  return outbox.slice(0, size);
}

export function parseOutbox(raw: string | null | undefined): PendingReview[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (e): e is PendingReview =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as PendingReview).id === 'string' &&
        typeof (e as PendingReview).cardId === 'string' &&
        typeof (e as PendingReview).reviewedAt === 'string' &&
        [1, 2, 3, 4].includes((e as PendingReview).rating),
    );
  } catch {
    // A corrupted entry must not take the review screen down with it.
    return [];
  }
}
