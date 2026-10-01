import { DAY_MS } from '../common/dates';

/**
 * Current and longest runs of consecutive study days.
 *
 * `recordReview` moves the streak forward one review at a time; this is the
 * whole-history version for the two places the log is written in bulk: a
 * seeded account, and an import. Days are day values (see `common/dates`),
 * distinct and sorted oldest first, and `today` is the same kind of value:
 * the day the user is in, not the server.
 */
export function streaks(
  studyDays: readonly Date[],
  today: Date,
): { current: number; longest: number } {
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of studyDays) {
    const n = Math.round(day.getTime() / DAY_MS);
    run = prev !== null && n === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = n;
  }
  const now = Math.round(today.getTime() / DAY_MS);
  const current = prev !== null && now - prev <= 1 ? run : 0;
  return { current, longest };
}
