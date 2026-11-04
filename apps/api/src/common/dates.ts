/**
 * Day bucketing, in the account's own time zone.
 *
 * Every date key the API hands out -- heatmap, forecast, streak, exam day --
 * is a calendar day where the user lives, because that is the day they mean
 * when they say "today". The server's local zone would make the streak break
 * at midnight in whatever region the container happens to run in, and a
 * redeploy to a different region would silently shift everyone's history by
 * a day. UTC is what an account without a zone gets, and what server quotas
 * (the AI allowance) are counted in regardless.
 *
 * A calendar day is carried around as a `Date` at UTC midnight of that date:
 * a day number in disguise, which `addDays` and `daysBetween` can do plain
 * arithmetic on, and which Postgres `::date` values arrive as. The moment a
 * day begins in a zone is a different thing, and `instantOf` turns one into
 * the other.
 */

export const DAY_MS = 86_400_000;

export const UTC = 'UTC';

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Throws for a zone Intl does not know. */
function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(zone, f);
  }
  return f;
}

/**
 * The stored zone, or UTC when there is none or it is one this runtime does
 * not know. A bad value cannot reach the column through the API, but a
 * trimmed ICU build is not a reason for every stats page to answer 500.
 */
export function zoneOf(stored: string | null | undefined): string {
  if (!stored) return UTC;
  try {
    formatter(stored);
    return stored;
  } catch {
    return UTC;
  }
}

/** The wall clock in `zone` at `at`, read as if it were UTC: a number to do day arithmetic on. */
function wallClock(at: Date, zone: string): number {
  const read: Record<string, number> = {};
  for (const part of formatter(zone).formatToParts(at)) {
    if (part.type !== 'literal') read[part.type] = Number(part.value);
  }
  return (
    Date.UTC(
      read.year ?? 1970,
      (read.month ?? 1) - 1,
      read.day ?? 1,
      read.hour === 24 ? 0 : (read.hour ?? 0),
      read.minute ?? 0,
      read.second ?? 0,
    ) + at.getUTCMilliseconds()
  );
}

/** The calendar day a moment falls in, in `zone`, as a day value. */
export function localDay(at: Date, zone: string): Date {
  const wall = wallClock(at, zone);
  return new Date(Math.floor(wall / DAY_MS) * DAY_MS);
}

/** `YYYY-MM-DD` of a day value. */
export function keyOfDay(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` for the day a moment falls in, in `zone`. */
export function dayKey(at: Date, zone: string): string {
  return keyOfDay(localDay(at, zone));
}

/**
 * The moment a day value begins in `zone`.
 *
 * The zone's offset is read at noon of that day and then again at the
 * midnight that gives, so a transition during the night is caught. The one
 * case this cannot settle, a midnight that a clock change skipped, lands an
 * hour either side, which is where the clocks themselves put it.
 */
export function instantOf(day: Date, zone: string): Date {
  const noon = day.getTime() + DAY_MS / 2;
  const first = day.getTime() - (wallClock(new Date(noon), zone) - noon);
  const offset = wallClock(new Date(first), zone) - first;
  return new Date(day.getTime() - offset);
}

/** The moment the day containing `at` began, in `zone`. */
export function dayStart(at: Date, zone: string): Date {
  return instantOf(localDay(at, zone), zone);
}

/** Midnight UTC starting the UTC day a moment falls in: for server-side quotas and windows. */
export function startOfDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/** Day arithmetic on day values. On an instant it is a plain 24-hour step. */
export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * DAY_MS);
}

/** Whole calendar days from `a` to `b` in `zone`, negative when b is earlier. */
export function daysBetween(a: Date, b: Date, zone: string): number {
  return Math.round((localDay(b, zone).getTime() - localDay(a, zone).getTime()) / DAY_MS);
}
