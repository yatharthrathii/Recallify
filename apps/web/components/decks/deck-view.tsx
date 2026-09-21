'use client';

import type { Card } from '@recallify/contracts';
import {
  ApiError,
  describeInterval,
  formatCount,
  formatDue,
  formatPercent,
} from '@recallify/core';
import {
  useCards,
  useCurve,
  useDeck,
  useDeckStats,
  useDeleteDeck,
  useMe,
  useUpdateDeck,
} from '@recallify/core/react';
import { DEFAULT_PARAMS, elapsedDays, retrievability } from '@recallify/fsrs';
import { ArrowLeft, MoreHorizontal, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ForecastBars } from '@/components/charts/forecast-bars';
import { ForgettingCurve, fitYMin } from '@/components/curve/forgetting-curve';
import { CountUp } from '@/components/motion';
import { PageShell, Section } from '@/components/shell/app-shell';
import { Button, IconButton, LinkButton } from '@/components/ui/button';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/controls';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  Badge,
  EmptyState,
  ErrorState,
  Recall,
  Skeleton,
  StatStrip,
  StatTile,
  StateBadge,
  messageOf,
} from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { CardDialog } from './card-dialog';
import { DeckFormDialog } from './deck-form-dialog';
import { DeckSwatch } from './deck-swatch';
import { GenerateDialog } from './generate-dialog';

/**
 * Predicted recall for a row, computed in the browser by the same engine the
 * server uses. The published default parameters are used here: the list is a
 * glance, and the exact per-user figure is one click away in the card itself.
 */
function recallNow(card: Card, now: Date): number | null {
  if (card.state === 'NEW' || !card.lastReviewedAt) return null;
  return retrievability(
    DEFAULT_PARAMS,
    elapsedDays(card.lastReviewedAt, now),
    card.stability,
  );
}

export function DeckView({ deckId }: { deckId: string }) {
  const router = useRouter();
  const deck = useDeck(deckId);
  const stats = useDeckStats(deckId);
  const cards = useCards(deckId);
  const curve = useCurve({ deckId });
  const me = useMe();
  const update = useUpdateDeck(deckId);
  const remove = useDeleteDeck();

  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingDeck, setEditingDeck] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openCard, setOpenCard] = useState<Card | null>(null);

  if (deck.isError) {
    const missing = deck.error instanceof ApiError && deck.error.status === 404;
    return (
      <PageShell title={missing ? 'Deck not found' : 'Deck'}>
        {missing ? (
          <EmptyState
            title="This deck does not exist"
            body="It may have been deleted, or the link is wrong."
            action={<LinkButton href="/decks">Back to decks</LinkButton>}
          />
        ) : (
          <ErrorState error={deck.error} onRetry={() => void deck.refetch()} />
        )}
      </PageShell>
    );
  }

  const now = new Date();
  const d = deck.data;
  const s = stats.data;
  const list = cards.data?.items ?? [];
  const archived = Boolean(d?.archivedAt);

  return (
    <PageShell
      eyebrow={
        <Link
          href="/decks"
          className="inline-flex items-center gap-1.5 text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Decks
        </Link>
      }
      title={
        d ? (
          <span className="flex items-center gap-3">
            <DeckSwatch color={d.color} className="size-4" />
            <span className="min-w-0 break-words">{d.title}</span>
            {archived ? <Badge>Archived</Badge> : null}
          </span>
        ) : (
          <Skeleton className="h-9 w-64" />
        )
      }
      description={d?.description ?? undefined}
      actions={
        <>
          {d && d.dueCount > 0 && !archived ? (
            <LinkButton href={`/review?deck=${deckId}`} variant="primary">
              Review <span className="tabular opacity-70">{d.dueCount}</span>
            </LinkButton>
          ) : null}
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add card
          </Button>
          <Button onClick={() => setGenerating(true)}>
            <Sparkles className="size-4" />
            Generate
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <IconButton
                label="Deck options"
                className="border border-line-strong bg-surface size-10"
              >
                <MoreHorizontal className="size-4" />
              </IconButton>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => setEditingDeck(true)}>Edit details</MenuItem>
              <MenuItem
                onSelect={() =>
                  update.mutate(
                    { archived: !archived },
                    {
                      onSuccess: () =>
                        toast.success(
                          archived
                            ? 'Deck restored.'
                            : 'Deck archived. Nothing was deleted.',
                        ),
                      onError: (error) => toast.error(messageOf(error)),
                    },
                  )
                }
              >
                {archived ? 'Restore from archive' : 'Archive'}
              </MenuItem>
              <MenuSeparator />
              <MenuItem danger onSelect={() => setConfirmDelete(true)}>
                Delete deck
              </MenuItem>
            </MenuContent>
          </Menu>
        </>
      }
    >
      <StatStrip className="mb-10 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Cards"
          value={
            s ? (
              <CountUp value={s.total} format={(n) => formatCount(Math.round(n))} />
            ) : (
              <Skeleton className="h-7 w-12" />
            )
          }
          sub={s ? `${s.newCards} new` : undefined}
        />
        <StatTile
          label="Due now"
          value={
            s ? (
              <CountUp value={s.dueNow} className={cn(s.dueNow > 0 && 'text-accent')} />
            ) : (
              <Skeleton className="h-7 w-10" />
            )
          }
          sub={s ? `${s.learning + s.relearning} in learning` : undefined}
        />
        <StatTile
          label="In review"
          value={
            s ? (
              <CountUp value={s.review} format={(n) => formatCount(Math.round(n))} />
            ) : (
              <Skeleton className="h-7 w-12" />
            )
          }
          sub="Graduated cards"
        />
        <StatTile
          label="Mean recall"
          value={
            s ? (
              s.review + s.learning + s.relearning > 0 ? (
                <CountUp value={s.averageRetrievability} format={formatPercent} />
              ) : (
                'n/a'
              )
            ) : (
              <Skeleton className="h-7 w-14" />
            )
          }
          sub={me.data ? `Target ${formatPercent(me.data.desiredRetention)}` : undefined}
        />
        <StatTile
          label="Mean stability"
          value={
            s ? (
              s.averageStabilityDays > 0 ? (
                describeInterval(s.averageStabilityDays)
              ) : (
                'n/a'
              )
            ) : (
              <Skeleton className="h-7 w-16" />
            )
          }
          sub="Time to fall to 90%"
        />
      </StatStrip>

      <div className="mb-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Section
          title="Where this deck is heading"
          aside="If you stopped reviewing today"
        >
          {curve.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : curve.isError ? (
            <ErrorState error={curve.error} onRetry={() => void curve.refetch()} />
          ) : (
            <ForgettingCurve
              points={curve.data?.points ?? []}
              desiredRetention={curve.data?.desiredRetention ?? 0.9}
              {...(curve.data && curve.data.dueInDays > 0
                ? { dueInDays: curve.data.dueInDays }
                : {})}
              yMin={fitYMin(
                curve.data?.points ?? [],
                curve.data?.desiredRetention ?? 0.9,
              )}
              // A deck is not "due" on one day. This is where its mean slips under the target.
              crossingLabel="below target on day"
              xLabel="Days from today, mean over reviewed cards"
              summary="Mean predicted recall for this deck over the next sixty days."
            />
          )}
        </Section>

        <Section title="Due over 30 days">
          {stats.isLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : (
            <ForecastBars days={s?.forecast ?? []} />
          )}
        </Section>
      </div>

      <Section
        title="Cards"
        aside={
          cards.data ? <span className="tabular">{list.length} shown</span> : undefined
        }
      >
        {cards.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : cards.isError ? (
          <ErrorState error={cards.error} onRetry={() => void cards.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title="No cards in this deck"
            body="Add cards by hand, or generate drafts from a topic or your own notes and keep the good ones."
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setAdding(true)}>
                  Add a card
                </Button>
                <Button onClick={() => setGenerating(true)}>Generate drafts</Button>
              </div>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_104px_88px_96px] gap-4 border-b border-line px-5 py-2.5 md:grid">
              <span className="eyebrow">Front</span>
              <span className="eyebrow">Back</span>
              <span className="eyebrow">State</span>
              <span className="eyebrow text-right">Recall</span>
              <span className="eyebrow text-right">Due</span>
            </div>
            <ul className="divide-y divide-line">
              {list.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => setOpenCard(card)}
                    className={cn(
                      'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left',
                      'transition-colors duration-200 hover:bg-paper sm:px-5',
                      'md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_104px_88px_96px]',
                      card.suspendedAt && 'opacity-55',
                    )}
                  >
                    <span className="truncate text-ui font-medium text-ink">
                      {card.front}
                    </span>
                    <span className="hidden truncate text-ui text-ink-muted md:block">
                      {card.back}
                    </span>
                    <span className="hidden md:block">
                      {card.suspendedAt ? (
                        <Badge>Suspended</Badge>
                      ) : (
                        <StateBadge state={card.state} />
                      )}
                    </span>
                    <span className="flex justify-end">
                      <Recall value={recallNow(card, now)} />
                    </span>
                    <span className="tabular col-span-2 text-caption text-ink-muted md:col-span-1 md:text-right">
                      {/* A new card is not late. It has simply not been started. */}
                      {card.suspendedAt
                        ? 'suspended'
                        : card.state === 'NEW'
                          ? 'not started'
                          : formatDue(card.dueAt, now)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {cards.data?.nextCursor ? (
          <p className="mt-3 text-caption text-ink-muted">
            Showing the newest {list.length}. Older cards are still reviewed as normal.
          </p>
        ) : null}
      </Section>

      <CardDialog open={adding} onOpenChange={setAdding} deckId={deckId} />
      <CardDialog
        open={openCard !== null}
        onOpenChange={(open) => !open && setOpenCard(null)}
        deckId={deckId}
        {...(openCard ? { card: openCard } : {})}
      />
      <GenerateDialog open={generating} onOpenChange={setGenerating} deckId={deckId} />
      {d ? (
        <DeckFormDialog open={editingDeck} onOpenChange={setEditingDeck} deck={d} />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this deck?"
        description={
          <>
            This removes the deck, its{' '}
            <span className="tabular">{d?.cardCount ?? 0}</span> cards and all of their
            review history. It cannot be undone. Archiving hides the deck and keeps
            everything.
          </>
        }
        confirmLabel="Delete deck"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(deckId, {
            onSuccess: () => {
              toast.success('Deck deleted.');
              router.replace('/decks');
            },
            onError: (error) => toast.error(messageOf(error)),
          })
        }
      />
    </PageShell>
  );
}
