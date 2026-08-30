import { z } from 'zod';
import { cuid } from './common';

/**
 * Auth contracts.
 *
 * The refresh token never appears in a request or response body on web: it
 * lives in an httpOnly cookie that JavaScript cannot read, so an XSS cannot
 * steal it. Mobile has no cookie jar, so it sends the token explicitly and
 * keeps it in the OS keychain instead.
 */

export const email = z.string().trim().toLowerCase().email().max(254);

/**
 * Long rather than complex. Composition rules push people toward
 * "Password1!" and no further; length is what actually costs an attacker.
 * 72 bytes is bcrypt's ceiling -- we use argon2id, which has no such limit,
 * but staying under it keeps the door open.
 */
export const password = z.string().min(10).max(72);

export const registerRequest = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(60).optional(),
});
export type RegisterRequest = z.infer<typeof registerRequest>;

export const loginRequest = z.object({ email, password });
export type LoginRequest = z.infer<typeof loginRequest>;

/** Mobile only. Web sends nothing: the cookie travels on its own. */
export const refreshRequest = z.object({
  refreshToken: z.string().min(32).optional(),
});
export type RefreshRequest = z.infer<typeof refreshRequest>;

/**
 * Short-lived and held in memory. Never written to localStorage -- v1 kept its
 * token there, where any injected script could read it.
 */
export const authTokens = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
  /** Returned to mobile only; web receives it as a cookie. */
  refreshToken: z.string().optional(),
});
export type AuthTokens = z.infer<typeof authTokens>;

export const currentUser = z.object({
  id: cuid,
  email: z.string().email(),
  displayName: z.string().nullable(),
  createdAt: z.coerce.date(),
  isDemo: z.boolean(),

  desiredRetention: z.number().min(0.7).max(0.99),
  dailyNewLimit: z.number().int().min(0).max(9999),
  dailyReviewLimit: z.number().int().min(0).max(9999),
  /** Empty until the optimizer has run; the engine falls back to defaults. */
  hasOptimizedParams: z.boolean(),
  paramsOptimizedAt: z.coerce.date().nullable(),
});
export type CurrentUser = z.infer<typeof currentUser>;

export const updateSettingsRequest = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    /**
     * Raising this shortens every interval. The UI shows the workload that
     * implies before the change is saved -- the number comes straight from the
     * engine, so the trade-off is visible rather than buried in a setting.
     */
    desiredRetention: z.number().min(0.7).max(0.99),
    dailyNewLimit: z.number().int().min(0).max(9999),
    dailyReviewLimit: z.number().int().min(0).max(9999),
  })
  .partial();
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequest>;
