import type { DeckColor } from '@recallify/contracts';
import { cn } from '@/lib/cn';

/** A deck's label colour. Identification only; see the note in tokens. */
export function DeckSwatch({
  color,
  className,
}: {
  color: DeckColor;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-3 shrink-0 rounded-[3px] border border-ink/10',
        className,
      )}
      style={{ background: `var(--deck-${color})` }}
    />
  );
}
