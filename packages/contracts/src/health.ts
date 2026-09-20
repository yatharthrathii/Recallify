import { z } from 'zod';

/** Liveness. Deliberately says nothing about the database -- see the handler. */
export const liveness = z.object({
  status: z.literal('ok'),
  /** Seconds this process has been running. */
  uptime: z.number().int().min(0),
});
export type Liveness = z.infer<typeof liveness>;

/** Readiness. Answers 503 with the same body when a check is down. */
export const readiness = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({ database: z.enum(['up', 'down']) }),
});
export type Readiness = z.infer<typeof readiness>;
