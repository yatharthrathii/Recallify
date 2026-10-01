import { DAY_MS, startOfDay } from '../common/dates';

/**
 * Current and longest runs of consecutive UTC study days.
 *
 * `recordReview` moves the streak forward one review at a time; this is the
 * whole-history version for the two places the log is written in bulk: a
 * seeded account, and an import. Days must be distinct and sorted, oldest
 * first.
 */
export function streaks(
  studyDays: readonly Date[],
  now: Date,
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
  const today = Math.round(startOfDay(now).getTime() / DAY_MS);
  const current = prev !== null && today - prev <= 1 ? run : 0;
  return { current, longest };
}
