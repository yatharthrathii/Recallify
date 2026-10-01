'use client';

import type { DeckChange } from '@recallify/contracts';
import { formatDate } from '@recallify/core';
import { Stagger, StaggerItem } from '@/components/motion';
import { Badge } from '@/components/ui/misc';

const KIND: Record<DeckChange['kind'], { label: string; tone: 'neutral' | 'info' | 'danger' }> = {
  ADDED: { label: 'Added', tone: 'info' },
  EDITED: { label: 'Edited', tone: 'neutral' },
  REMOVED: { label: 'Removed', tone: 'danger' },
  NOTE: { label: 'Note', tone: 'neutral' },
};

/**
 * What an author did to a published deck, newest first. A note is the
 * author's own sentence and is set in the text colour; the rest name a card.
 */
export function Changelog({
  changes,
  empty = 'No changes yet.',
}: {
  changes: readonly DeckChange[];
  empty?: string;
}) {
  if (changes.length === 0) return <p className="text-ui text-ink-muted">{empty}</p>;
  return (
    <Stagger as="ol" gap={0.04} delay={0.05} className="flex flex-col divide-y divide-line">
      {changes.map((change) => {
        const kind = KIND[change.kind];
        return (
          <StaggerItem as="li" key={change.id} className="flex items-start gap-3 py-2.5">
            <Badge tone={kind.tone} className="mt-0.5 w-18 shrink-0 justify-center">
              {kind.label}
            </Badge>
            <span
              className={`min-w-0 flex-1 text-ui ${change.kind === 'NOTE' ? 'text-ink' : 'text-ink-muted'}`}
            >
              {change.summary}
            </span>
            <span className="tabular shrink-0 text-caption text-ink-faint">
              {formatDate(change.createdAt)}
            </span>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
