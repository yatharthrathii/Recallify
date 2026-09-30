'use client';

import { formatCount, formatPercent } from '@recallify/core';
import { useDecks, useExam } from '@recallify/core/react';
import { memoryLevel, type MemoryLevel } from '@recallify/tokens';
import Link from 'next/link';
import { useState } from 'react';
import { CountUp } from '@/components/motion';
import { Section } from '@/components/shell/app-shell';
import { SelectField, TextField } from '@/components/ui/field';
import { ErrorState, Recall, Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

const DAY = 86_400_000;
const LEVEL_BG: Record<MemoryLevel, string> = {
  strong: 'bg-mem-strong',
  good: 'bg-mem-good',
  fading: 'bg-mem-fading',
  weak: 'bg-mem-weak',
  lost: 'bg-mem-lost',
};

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
}

/**
 * Exam day.
 *
 * The one question every student with a date is asking, answered from the
 * same curves the rest of the app draws: how many of these cards will I
 * still know on the day. Shown with its range and, when a report has
 * measured it, how far the model has been from right about this person.
 */
export function ExamDay() {
  const [date, setDate] = useState(() => isoDay(30));
  const [deckId, setDeckId] = useState('');
  const decks = useDecks();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= isoDay(0);
  const exam = useExam(valid ? date : null, deckId || undefined);
  const e = exam.data;

  return (
    <Section title="Exam day" className="mb-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div>
          <p className="max-w-[60ch] text-ui text-ink-muted">
            Pick the date. Every card you have reviewed is projected forward to it
            along its own curve, and the chances are added up. Nothing between now
            and then is guessed at; the list on the right is what a single answer
            today would change.
          </p>
          <div className="mt-5 flex flex-col gap-4">
            <TextField
              label="Date"
              type="date"
              min={isoDay(0)}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              error={valid ? undefined : 'Choose today or a later date.'}
            />
            <SelectField label="Deck" value={deckId} onChange={(event) => setDeckId(event.target.value)}>
              <option value="">Every deck</option>
              {(decks.data?.items ?? []).map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.title}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        <div>
          {!valid ? null : exam.isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : exam.isError ? (
            <ErrorState error={exam.error} onRetry={() => void exam.refetch()} />
          ) : e ? (
            <div>
              {e.cardsCounted === 0 ? (
                <p className="text-ui text-ink-muted">
                  {e.newCards > 0
                    ? `${formatCount(e.newCards)} cards here have never been reviewed, so there is no curve to project yet. Review them once and the forecast appears.`
                    : 'No cards to forecast. Add some, or choose another deck.'}
                </p>
              ) : (
                <>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-ink">
                    <span className="tabular font-display text-[40px] font-semibold leading-none sm:text-[48px]">
                      <CountUp value={e.expectedRecalled} format={(n) => formatCount(Math.round(n))} />
                    </span>
                    <span className="text-body text-ink-muted">
                      of <span className="tabular text-ink">{formatCount(e.cardsCounted)}</span> cards
                      still known in {e.daysAway} {e.daysAway === 1 ? 'day' : 'days'}
                    </span>
                  </p>
                  <p className="mt-2 text-caption text-ink-muted">
                    Likely between{' '}
                    <span className="tabular text-ink">{formatCount(Math.round(e.low))}</span> and{' '}
                    <span className="tabular text-ink">{formatCount(Math.round(e.high))}</span>, if
                    nothing is reviewed between now and then.{' '}
                    {e.calibrationError !== null ? (
                      <>
                        The model has been within{' '}
                        <span className="tabular text-ink">{formatPercent(e.calibrationError)}</span> of
                        your actual recall, from your latest report.
                      </>
                    ) : (
                      <>
                        How far the model tends to be from right about you is measured by the{' '}
                        <Link href="/stats/report" className="underline underline-offset-4">
                          Memory Report
                        </Link>
                        .
                      </>
                    )}
                    {e.newCards > 0
                      ? ` ${formatCount(e.newCards)} new ${e.newCards === 1 ? 'card is' : 'cards are'} not counted.`
                      : ''}
                  </p>

                  <div
                    role="img"
                    aria-label={`Cards by predicted recall on the date, from 0 to 100% in ten bands.`}
                    className="mt-5 flex h-16 items-end gap-0.75"
                  >
                    {e.histogram.map((count, i) => {
                      const peak = Math.max(1, ...e.histogram);
                      return (
                        <div
                          key={i}
                          title={`${i * 10} to ${(i + 1) * 10}%: ${count} cards`}
                          className={cn(
                            'flex-1 rounded-t-[3px]',
                            count === 0 ? 'bg-line-strong' : LEVEL_BG[memoryLevel((i + 0.5) / 10)],
                          )}
                          style={{ height: `${Math.max(count > 0 ? 6 : 2, (count / peak) * 100)}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-ink-faint" aria-hidden>
                    <span>0% chance</span>
                    <span>100%</span>
                  </div>

                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <CardList
                      title="Most likely gone by then"
                      cards={e.atRisk.slice(0, 8)}
                      render={(card) => <Recall value={card.retrievability} />}
                    />
                    <CardList
                      title="Best single reviews today"
                      cards={e.bestMoves.slice(0, 8)}
                      render={(card) => (
                        <span className="tabular text-ui text-ink">
                          +{formatPercent(card.gain ?? 0)}
                        </span>
                      )}
                    />
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function CardList<T extends { cardId: string; deckId: string; deckTitle: string; front: string }>({
  title,
  cards,
  render,
}: {
  title: string;
  cards: readonly T[];
  render: (card: T) => React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      {cards.length === 0 ? (
        <p className="text-caption text-ink-muted">Nothing to show.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {cards.map((card) => (
            <li key={card.cardId} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-ui text-ink">{card.front}</p>
                <Link
                  href={`/decks/${card.deckId}`}
                  className="block truncate text-caption text-ink-muted underline-offset-4 hover:underline"
                >
                  {card.deckTitle}
                </Link>
              </div>
              {render(card)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
