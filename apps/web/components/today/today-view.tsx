'use client';

import { estimateMinutes, formatCount, formatPercent } from '@recallify/core';
import { useDecks, useForecast, useMe, useOverview } from '@recallify/core/react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ForecastBars } from '@/components/charts/forecast-bars';
import { DeckSwatch } from '@/components/decks/deck-swatch';
import { CountUp, EASE, Stagger, StaggerItem } from '@/components/motion';
import { PageShell, Section } from '@/components/shell/app-shell';
import { LinkButton } from '@/components/ui/button';
import {
  EmptyState,
  ErrorState,
  Skeleton,
  StatStrip,
  StatTile,
} from '@/components/ui/misc';

function greetingDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function TodayView() {
  const me = useMe();
  const overview = useOverview();
  const decks = useDecks();
  const forecast = useForecast(14);

  if (overview.isError) {
    return (
      <PageShell title="Today">
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      </PageShell>
    );
  }

  const stats = overview.data;
  const due = stats?.dueToday ?? 0;
  const dueDecks = (decks.data?.items ?? []).filter((d) => d.dueCount > 0);
  const hasDecks = (decks.data?.items.length ?? 0) > 0;

  return (
    <PageShell
      title="Today"
      eyebrow={
        // The date is formatted in the visitor's timezone, which the server
        // cannot know, so the two renders may legitimately differ.
        <span className="eyebrow" suppressHydrationWarning>
          {greetingDate()}
        </span>
      }
    >
      {/* The one thing this page is for, and the one block of brand colour on it. */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
        className="relative mb-10 flex flex-col gap-6 overflow-hidden rounded-lg bg-brand p-6 text-on-brand sm:flex-row sm:items-end sm:justify-between sm:p-9"
      >
        {/* A flat disc, the same one as the landing page, sliding in from the corner. */}
        <motion.span
          aria-hidden
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.3, ease: EASE, delay: 0.35 }}
          className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-on-brand/10 sm:size-80"
        />
        {overview.isLoading ? (
          <div className="flex flex-col gap-3">
            <div className="h-14 w-64 rounded-sm bg-on-brand/15" />
            <div className="h-4 w-40 rounded-sm bg-on-brand/15" />
          </div>
        ) : due > 0 ? (
          <div className="relative">
            <p className="font-display text-[clamp(34px,5vw,56px)] font-semibold leading-[1.02]">
              <CountUp value={due} format={(n) => formatCount(Math.round(n))} />{' '}
              {due === 1 ? 'card is' : 'cards are'} due.
            </p>
            <p className="mt-3 text-ui text-on-brand/75">
              About <span className="tabular text-on-brand">{estimateMinutes(due)}</span>{' '}
              {estimateMinutes(due) === 1 ? 'minute' : 'minutes'}
              {me.data ? `, capped at ${me.data.dailyReviewLimit} reviews a day.` : '.'}
            </p>
          </div>
        ) : (
          <div className="relative">
            <p className="font-display text-[clamp(34px,5vw,56px)] font-semibold leading-[1.02]">
              Nothing is due.
            </p>
            <p className="mt-3 text-ui text-on-brand/75">
              {hasDecks
                ? 'Every card is scheduled for later. You can study ahead, or add cards.'
                : 'Create a deck and add a few cards to begin.'}
            </p>
          </div>
        )}
        <div className="relative flex shrink-0 gap-2">
          {/* No button until the numbers are in: which one is right depends on them. */}
          {overview.isLoading || decks.isLoading ? null : due > 0 ? (
            <LinkButton
              href="/review"
              variant="inverse"
              size="lg"
              className="group w-full sm:w-auto"
            >
              Start review
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </LinkButton>
          ) : hasDecks ? (
            <LinkButton
              href="/review?ahead=1"
              variant="inverse"
              size="lg"
              className="w-full sm:w-auto"
            >
              Study ahead
            </LinkButton>
          ) : (
            <LinkButton
              href="/decks?new=1"
              variant="inverse"
              size="lg"
              className="w-full sm:w-auto"
            >
              Create a deck
            </LinkButton>
          )}
        </div>
      </motion.div>

      <StatStrip className="mb-10 sm:grid-cols-4">
        <StatTile
          label="Streak"
          value={
            overview.isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <CountUp value={stats?.streak ?? 0} format={(n) => `${Math.round(n)}d`} />
            )
          }
          sub={stats ? `Longest ${stats.longestStreak}d` : undefined}
        />
        <StatTile
          label="Recalled, 30 days"
          value={
            overview.isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : stats && stats.totalReviews > 0 ? (
              <CountUp value={stats.retention} format={formatPercent} />
            ) : (
              'n/a'
            )
          }
          sub={me.data ? `Target ${formatPercent(me.data.desiredRetention)}` : undefined}
        />
        <StatTile
          label="Reviews"
          value={
            overview.isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <CountUp
                value={stats?.totalReviews ?? 0}
                format={(n) => formatCount(Math.round(n))}
              />
            )
          }
          sub={stats ? `${formatCount(stats.totalCards)} cards` : undefined}
        />
        <StatTile
          label="Level"
          value={
            overview.isLoading ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <CountUp value={stats?.level ?? 1} />
            )
          }
          sub={stats ? `${formatCount(stats.xp)} xp` : undefined}
        />
      </StatStrip>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Section
          title="Due by deck"
          aside={
            <Link
              href="/decks"
              className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              All decks
            </Link>
          }
        >
          {decks.isLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : decks.isError ? (
            <ErrorState error={decks.error} onRetry={() => void decks.refetch()} />
          ) : !hasDecks ? (
            <EmptyState
              title="No decks yet"
              body="A deck is a set of cards on one subject. Make one, add cards by hand or generate drafts from your notes, and the first review is ready straight away."
              action={
                <LinkButton href="/decks?new=1" variant="primary">
                  Create a deck
                </LinkButton>
              }
            />
          ) : dueDecks.length === 0 ? (
            <p className="text-ui text-ink-muted">No deck has cards due right now.</p>
          ) : (
            <Stagger
              as="ul"
              gap={0.06}
              className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface"
            >
              {dueDecks.map((deck) => (
                <StaggerItem
                  as="li"
                  key={deck.id}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-paper"
                >
                  <DeckSwatch color={deck.color} />
                  <Link
                    href={`/decks/${deck.id}`}
                    className="min-w-0 flex-1 truncate text-ui font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {deck.title}
                  </Link>
                  <span className="tabular text-ui text-ink-muted">
                    <span className="text-ink">{deck.dueCount}</span> due
                  </span>
                  <LinkButton href={`/review?deck=${deck.id}`} size="sm">
                    Review
                  </LinkButton>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </Section>

        <Section title="Next 14 days">
          {forecast.isLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : forecast.isError ? (
            <ErrorState error={forecast.error} onRetry={() => void forecast.refetch()} />
          ) : (
            <ForecastBars days={forecast.data?.days ?? []} />
          )}
        </Section>
      </div>
    </PageShell>
  );
}
