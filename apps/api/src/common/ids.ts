import { createHash, randomBytes } from 'node:crypto';

/**
 * A card id made in Node, for the writes that create many cards at once and
 * need to know each row's id before the INSERT returns. Same shape as the
 * cuids Prisma makes by default (a `c` and 24 characters), so the contracts'
 * `cuid` schema accepts both and nothing downstream can tell them apart.
 */
export function newCardId(): string {
  return `c${randomBytes(12).toString('hex')}`;
}

/**
 * A review id that is deterministic per user.
 *
 * Imported reviews carry an id derived from the source file, so importing the
 * same file twice collides and is refused. The review table's id is global,
 * though, and two people importing the same shared deck must not collide with
 * each other. Hashing the user in gives every account its own id for the same
 * review, still stable across that account's retries. UUID shaped, version 5
 * bits set, so it sits beside the random v4 ids of live reviews.
 */
export function reviewIdFor(userId: string, sourceId: string): string {
  const hex = createHash('sha256').update(`${userId}:${sourceId}`).digest('hex');
  const variant = ((parseInt(hex[16] as string, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
