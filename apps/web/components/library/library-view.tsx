'use client';

import { formatCount, formatDate, formatFollowers } from '@recallify/core';
import { useLibrary } from '@recallify/core/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DeckSwatch } from '@/components/decks/deck-swatch';
import { Stagger, StaggerItem } from '@/components/motion';
import { PageShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/field';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';

/** The contract's ceiling on a search; the field stops there rather than the list failing. */
const QUERY_MAX = 80;

/** The value once typing has paused, so a word is one request rather than six. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * Decks other people have published. Following one makes a copy that the
 * author's edits reach without ever touching the follower's progress.
 */
export function LibraryView() {
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 250);
  const library = useLibrary(q || undefined);
  const items = library.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <PageShell
      title="Library"
      description="Decks people have published and keep improving. Follow one and it becomes a deck of your own, scheduled by your answers, with the author's corrections arriving as they are made."
    >
      <div className="mb-6 max-w-md">
        <SearchField
          label="Search the library"
          placeholder="Search by title"
          value={query}
          maxLength={QUERY_MAX}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {library.isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : library.isError ? (
        <ErrorState error={library.error} onRetry={() => void library.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={q ? 'Nothing matches that' : 'Nothing published yet'}
          body={
            q
              ? 'Try a shorter word, or clear the search.'
              : 'Any deck of yours can be the first: open it and choose Publish to the library from its menu.'
          }
        />
      ) : (
        <>
          <Stagger
            as="ul"
            gap={0.05}
            delay={0.15}
            className={
              library.isPlaceholderData
                ? 'divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface opacity-60 transition-opacity'
                : 'divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface transition-opacity'
            }
          >
            {items.map((deck) => (
              <StaggerItem
                as="li"
                key={deck.id}
                className="group px-4 py-4 transition-colors duration-200 hover:bg-paper sm:px-5"
              >
                <div className="flex items-start gap-3">
                  <DeckSwatch color={deck.color} className="mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/library/${deck.id}`}
                        className="text-body font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {deck.title}
                      </Link>
                      {deck.isMine ? <Badge tone="info">Yours</Badge> : null}
                      {deck.subscribedDeckId ? <Badge tone="info">Following</Badge> : null}
                    </div>
                    {deck.description ? (
                      <p className="mt-0.5 line-clamp-2 text-ui text-ink-muted">{deck.description}</p>
                    ) : null}
                    <p className="tabular mt-1.5 text-caption text-ink-muted">
                      by {deck.authorName}, {formatCount(deck.cardCount)}{' '}
                      {deck.cardCount === 1 ? 'card' : 'cards'}, {formatFollowers(deck.subscriberCount)},
                      updated {formatDate(deck.updatedAt)}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          {library.hasNextPage ? (
            <div className="mt-4">
              <Button
                loading={library.isFetchingNextPage}
                onClick={() => void library.fetchNextPage()}
              >
                Show more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
