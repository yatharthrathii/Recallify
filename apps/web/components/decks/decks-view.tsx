'use client';

import { formatCount, formatDate } from '@recallify/core';
import { useDecks } from '@recallify/core/react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Stagger, StaggerItem } from '@/components/motion';
import { PageShell } from '@/components/shell/app-shell';
import { Button, LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { DeckFormDialog } from './deck-form-dialog';
import { DeckSwatch } from './deck-swatch';

export function DecksView() {
  const router = useRouter();
  const params = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const decks = useDecks(showArchived);

  const items = decks.data?.items ?? [];
  const totalDue = items.reduce((sum, d) => sum + d.dueCount, 0);
  const totalCards = items.reduce((sum, d) => sum + d.cardCount, 0);

  return (
    <PageShell
      title="Decks"
      description={
        decks.data
          ? `${items.length} ${items.length === 1 ? 'deck' : 'decks'}, ${formatCount(totalCards)} cards, ${formatCount(totalDue)} due now.`
          : undefined
      }
      actions={
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New deck
        </Button>
      }
    >
      {decks.isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-17 w-full rounded-lg" />
          ))}
        </div>
      ) : decks.isError ? (
        <ErrorState error={decks.error} onRetry={() => void decks.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={showArchived ? 'No decks at all' : 'No decks yet'}
          body="A deck is a set of cards on one subject. Each card gets its own forgetting curve from the first review onwards."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create your first deck
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {/* Column heads only where there are columns. */}
          <div className="hidden grid-cols-[minmax(0,1fr)_88px_88px_120px_96px] gap-4 border-b border-line px-5 py-2.5 md:grid">
            <span className="eyebrow">Deck</span>
            <span className="eyebrow text-right">Cards</span>
            <span className="eyebrow text-right">Due</span>
            <span className="eyebrow text-right">Updated</span>
            <span />
          </div>
          <Stagger as="ul" gap={0.06} delay={0.2} className="divide-y divide-line">
            {items.map((deck) => (
              <StaggerItem
                as="li"
                key={deck.id}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors duration-200 hover:bg-paper sm:px-5 md:grid-cols-[minmax(0,1fr)_88px_88px_120px_96px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1.5">
                    <DeckSwatch color={deck.color} />
                    <Link
                      href={`/decks/${deck.id}`}
                      className="truncate text-body font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {deck.title}
                    </Link>
                    {deck.archivedAt ? <Badge>Archived</Badge> : null}
                  </div>
                  {deck.description ? (
                    <p className="mt-0.5 truncate pl-5.5 text-ui text-ink-muted">
                      {deck.description}
                    </p>
                  ) : null}
                  {/* The numbers, inline, when there is no room for columns. */}
                  <p className="tabular mt-1 pl-5.5 text-caption text-ink-muted md:hidden">
                    {formatCount(deck.cardCount)} cards,{' '}
                    <span className={cn(deck.dueCount > 0 && 'text-accent')}>
                      {deck.dueCount} due
                    </span>
                  </p>
                </div>

                <span className="tabular hidden text-right text-ui text-ink md:block">
                  {formatCount(deck.cardCount)}
                </span>
                <span
                  className={cn(
                    'tabular hidden text-right text-ui md:block',
                    deck.dueCount > 0 ? 'text-accent' : 'text-ink-faint',
                  )}
                >
                  {deck.dueCount}
                </span>
                <span className="tabular hidden text-right text-caption text-ink-muted md:block">
                  {formatDate(deck.updatedAt)}
                </span>

                <div className="flex justify-end">
                  {deck.dueCount > 0 && !deck.archivedAt ? (
                    <LinkButton href={`/review?deck=${deck.id}`} size="sm">
                      Review
                    </LinkButton>
                  ) : (
                    <LinkButton href={`/decks/${deck.id}`} size="sm" variant="ghost">
                      Open
                    </LinkButton>
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      )}

      <label className="mt-5 inline-flex cursor-pointer items-center gap-2 text-ui text-ink-muted">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="size-4 accent-[var(--accent)]"
        />
        Show archived decks
      </label>

      <DeckFormDialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open && params.get('new')) router.replace('/decks');
        }}
        onCreated={(deck) => router.push(`/decks/${deck.id}`)}
      />
    </PageShell>
  );
}
