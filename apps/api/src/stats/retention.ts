import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Retention as measured, not predicted: of the cards the user was actually
 * asked to recall since `from`, how many did they. First-ever reviews are
 * excluded -- there was nothing to recall yet, and counting them would drag
 * the number toward whatever fraction of the user's study happens to be new
 * cards. The stats page and the report quote this figure from here, over
 * their own windows.
 */
export async function measuredRetention(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  from: Date,
): Promise<{ attempted: number; recalled: number; retention: number | null }> {
  const where = { userId, reviewedAt: { gte: from }, prevState: { not: 'NEW' as const } };
  const [attempted, recalled] = await Promise.all([
    db.review.count({ where }),
    db.review.count({ where: { ...where, rating: { gt: 1 } } }),
  ]);
  return { attempted, recalled, retention: attempted > 0 ? recalled / attempted : null };
}
