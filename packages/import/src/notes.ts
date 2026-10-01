import type { ImportNote, ImportNoteCode } from './types';

/** Counts what a reader left out, and says so in one line per kind. */
export class NoteTally {
  private readonly counts = new Map<ImportNoteCode, number>();

  add(code: ImportNoteCode, by = 1): void {
    if (by <= 0) return;
    this.counts.set(code, (this.counts.get(code) ?? 0) + by);
  }

  list(): ImportNote[] {
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const messages: Record<ImportNoteCode, (n: number) => string> = {
      media: (n) =>
        `${plural(n, 'card refers', 'cards refer')} to images or audio, which are not imported. The text is kept.`,
      'empty-card': (n) =>
        `${plural(n, 'card was', 'cards were')} skipped because one side had no text once images and formatting were removed.`,
      truncated: (n) => `${plural(n, 'card was', 'cards were')} shortened to 4,000 characters.`,
      'skipped-review': (n) =>
        `${plural(n, 'review was', 'reviews were')} left out: manual reschedules, entries with no rating, or history of a skipped card.`,
      'unknown-notetype': (n) =>
        `${plural(n, 'card uses', 'cards use')} a note type the file does not describe, and could not be read.`,
    };
    return [...this.counts.entries()].map(([code, count]) => ({
      code,
      count,
      message: messages[code](count),
    }));
  }
}
