/**
 * How numbers read in the interface. Shared, so the web app and the phone
 * never describe the same interval two different ways.
 *
 * Written by hand rather than with Intl.RelativeTimeFormat: the output has to
 * be compact enough for a rating button ("10m", "4d", "2.1mo"), which Intl
 * does not produce, and Hermes on Android ships only part of Intl anyway.
 */

const MINUTE = 1 / 1440;
const HOUR = 1 / 24;

function trim(value: number): string {
  // 2.0 reads as "2", 2.14 as "2.1".
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** An interval in days, as short as it can honestly be: 10m, 3h, 4d, 2.1mo, 1.4y. */
export function formatInterval(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'now';
  if (days < HOUR) return `${Math.max(1, Math.round(days / MINUTE))}m`;
  if (days < 1) return `${Math.round(days / HOUR)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${trim(days / 30)}mo`;
  return `${trim(days / 365)}y`;
}

/** The same interval in words, for sentences rather than buttons. */
export function describeInterval(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'now';
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (days < HOUR) return plural(Math.max(1, Math.round(days / MINUTE)), 'minute');
  if (days < 1) return plural(Math.round(days / HOUR), 'hour');
  if (days < 30) return plural(Math.round(days), 'day');
  if (days < 365) return `${trim(days / 30)} months`;
  return `${trim(days / 365)} years`;
}

/** When a card is due, relative to now: "due now", "in 3h", "2d overdue". */
export function formatDue(dueAt: Date, now: Date = new Date()): string {
  const days = (dueAt.getTime() - now.getTime()) / 86_400_000;
  if (Math.abs(days) < MINUTE) return 'due now';
  return days > 0 ? `in ${formatInterval(days)}` : `${formatInterval(-days)} overdue`;
}

/** A probability as a whole percentage. */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return '0%';
  return `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
}

/** 1,204 rather than 1204. */
export function formatCount(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Roughly how long a queue will take, at the pace people actually review.
 * Eight seconds a card is the usual Anki average; it is an estimate and the UI
 * says "about".
 */
export function estimateMinutes(cards: number, secondsPerCard = 8): number {
  return Math.max(1, Math.round((cards * secondsPerCard) / 60));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 21 Sep 2026. Unambiguous in every locale, unlike 09/21 or 21/09. */
export function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** 21 Sep, for axes and tooltips where the year is obvious. */
export function formatDayShort(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
