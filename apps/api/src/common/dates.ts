/**
 * Day bucketing, in UTC.
 *
 * Every date key in the API -- heatmap, forecast, streak -- is a UTC calendar
 * day. Using the server's local zone would make the streak break at midnight in
 * whatever region the container happens to run in, and a redeploy to a
 * different region would silently shift everyone's history by a day.
 *
 * Per-user timezones are a real feature and a later one; this is the honest
 * version of "not yet", not an oversight.
 */

export const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` for the UTC day a moment falls in. */
export function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** Midnight UTC starting the day a moment falls in. */
export function startOfDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * DAY_MS);
}

/** Whole UTC days from `a` to `b`, negative when b is earlier. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}
