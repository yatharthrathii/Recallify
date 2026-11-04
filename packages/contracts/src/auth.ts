import { z } from 'zod';
import { cuid, isoDate } from './common';

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

/** An IANA zone name this runtime knows, such as `Asia/Kolkata`. */
export function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Browsers still report some zones by a city's old name: Chrome says
 * `Asia/Calcutta` for a device in Kolkata. Both names schedule identically;
 * the current one is what gets stored and shown.
 */
const RENAMED: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Dacca': 'Asia/Dhaka',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Macao': 'Asia/Macau',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Thimbu': 'Asia/Thimphu',
  'Asia/Ulan_Bator': 'Asia/Ulaanbaatar',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
};

export function canonicalTimezone(value: string): string {
  return RENAMED[value] ?? value;
}

/**
 * The zone the account's days are counted in: streak, heatmap, forecast,
 * exam day. A device reports its own at sign-up, and a sign-in fills it in
 * for an account that has none yet; it never overrides one that is set,
 * because a week on a trip should not move the heatmap.
 */
export const timezone = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isTimezone, { message: 'Not a time zone this server knows.' })
  .transform(canonicalTimezone);

export const registerRequest = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(60).optional(),
  timezone: timezone.optional(),
});
export type RegisterRequest = z.infer<typeof registerRequest>;

export const loginRequest = z.object({
  email,
  password,
  /** Applied only to an account that has no zone yet. */
  timezone: timezone.optional(),
});
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
  createdAt: isoDate,
  isDemo: z.boolean(),

  desiredRetention: z.number().min(0.7).max(0.99),
  dailyNewLimit: z.number().int().min(0).max(9999),
  dailyReviewLimit: z.number().int().min(0).max(9999),
  /** Empty until the optimizer has run; the engine falls back to defaults. */
  hasOptimizedParams: z.boolean(),
  paramsOptimizedAt: isoDate.nullable(),
  /** Null means UTC: no device has reported a zone for this account yet. */
  timezone: z.string().nullable(),
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
    timezone,
  })
  .partial();
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequest>;

/**
 * Asking for a reset link. The answer is the same whether or not the address
 * has an account, so the endpoint cannot be used to discover which do.
 */
export const forgotPasswordRequest = z.object({ email });
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequest>;

/** The token from the emailed link, plus the new password. */
export const resetPasswordRequest = z.object({
  token: z.string().min(20).max(200),
  password,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequest>;

/**
 * Deleting an account asks for the password again. A session left open on a
 * shared laptop should not be enough to erase years of review history.
 */
export const deleteAccountRequest = z.object({ password: z.string().min(1).max(72) });
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequest>;
