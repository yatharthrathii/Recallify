import { z } from 'zod';

/**
 * Shared primitives. Every request and response schema in this package is the
 * single source of truth for three things at once: runtime validation in the
 * API, TypeScript types for web and mobile, and the OpenAPI document. There is
 * no second definition of any shape anywhere in the repo.
 */

export const cuid = z.string().cuid();
export const uuid = z.string().uuid();

/** Cursor pagination, never offset -- offset skips rows when data shifts. */
export const pageQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type PageQuery = z.infer<typeof pageQuery>;

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/** RFC 9457 problem+json. Every error response in the API uses this shape. */
export const problemDetails = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  traceId: z.string(),
});
export type ProblemDetails = z.infer<typeof problemDetails>;

export const rating = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export const cardState = z.enum(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING']);
export const cardSource = z.enum(['MANUAL', 'AI', 'IMPORT']);

/**
 * A boolean that arrives as a query-string value.
 *
 * Deliberately NOT `z.coerce.boolean()`. That is `Boolean(value)`, so every
 * non-empty string is true -- including the string "false". A flag written
 * that way can be switched on but never off, and the bug is invisible because
 * the happy path works.
 */
export const queryBoolean = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

/**
 * A date as it travels over the wire: an ISO 8601 string in, a Date out.
 *
 * Written as a string schema with a transform rather than `z.coerce.date()`,
 * for the OpenAPI document rather than for the runtime. Both accept a string
 * and yield a Date, but nestjs-zod cannot describe a ZodDate and emits an
 * empty schema for it, so every timestamp in the published API documented
 * itself as "anything" -- including `reviewedAt`, which is the one value an
 * offline client has to get right. A string with a transform documents itself
 * as `string / date-time`, which is what is actually on the wire.
 *
 * `.pipe()` does not work here either; only the transform is understood.
 */
export const isoDate = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));
