'use client';

import type { MemoryReport } from '@recallify/contracts';
import { formatCount, formatDate, formatPercent } from '@recallify/core';
import { useApplyParams, useCreateReport, useReportStatus } from '@recallify/core/react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Stagger, StaggerItem } from '@/components/motion';
import { PageShell, Section } from '@/components/shell/app-shell';
import { Button, LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, Recall, Skeleton, messageOf } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { CompareCurves } from './compare-curves';
import { PatternBars } from './pattern-bars';

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) =>
  h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
);
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RATING_NAME = ['', 'Again', 'Hard', 'Good', 'Easy'];

const daysWord = (n: number) => {
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'day' : 'days'}`;
};

/**
 * The Memory Report.
 *
 * The fit, in sentences, with the log's own patterns beside it. Everything on
 * the page is a stored snapshot: the date it was made is the first thing
 * shown, and the button to make a fresh one says when that is allowed.
 */
export function ReportView() {
  const status = useReportStatus();
  const create = useCreateReport();

  const s = status.data;
  const report = s?.latest ?? null;
  const blocked = s ? s.reviewCount === 0 || Boolean(s.nextAllowedAt) : true;

  const make = () =>
    create.mutate(undefined, {
      onSuccess: () => toast.success('Your report is ready.'),
      onError: (error) => toast.error(messageOf(error)),
    });

  return (
    <PageShell
      eyebrow={
        <Link
          href="/stats"
          className="inline-flex items-center gap-1.5 text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Stats
        </Link>
      }
      title="Memory Report"
      description={
        report
          ? `Made ${formatDate(report.createdAt)} from ${formatCount(report.reviewCount)} reviews across ${formatCount(report.cardCount)} cards. Measured figures cover the last ${report.windowDays} days.`
          : 'Your review log, read back to you: how fast you forget, when you remember best, which cards keep failing, and what each deck returns for the reviews it costs.'
      }
      actions={
        report ? (
          <Button
            variant="primary"
            disabled={blocked}
            loading={create.isPending}
            onClick={make}
          >
            {create.isPending ? 'Reading your history' : 'Make a new report'}
          </Button>
        ) : undefined
      }
    >
      {status.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : status.isError ? (
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      ) : !report ? (
        <EmptyState
          title={s && s.reviewCount === 0 ? 'Review a few cards first' : 'No report yet'}
          body={
            s && s.reviewCount === 0
              ? 'A report is drawn from your answers, and there are none yet. Come back after your first session, or import a deck with its history.'
              : `From ${formatCount(s?.minimumReviewsForFit ?? 400)} reviews the report includes a scheduler fitted to you. You have ${formatCount(s?.reviewCount ?? 0)}; below that it scores the published defaults on your history instead.`
          }
          action={
            <Button
              variant="primary"
              disabled={blocked}
              loading={create.isPending}
              onClick={make}
            >
              {create.isPending ? 'Reading your history' : 'Make my report'}
            </Button>
          }
        />
      ) : (
        <ReportBody report={report} nextAllowedAt={s?.nextAllowedAt ?? null} />
      )}
    </PageShell>
  );
}

function ReportBody({ report, nextAllowedAt }: { report: MemoryReport; nextAllowedAt: Date | null }) {
  const apply = useApplyParams();
  const { model, curve, patterns, leeches, decks } = report;
  const sourceLabel =
    curve.source === 'fitted'
      ? 'Fitted to you'
      : curve.source === 'adopted'
        ? 'Your adopted parameters'
        : 'Published defaults';

  return (
    <div className="flex flex-col gap-10">
      <Section title="Findings">
        <Stagger as="ol" gap={0.08} delay={0.1} className="flex flex-col gap-3">
          {report.statements.map((statement, i) => (
            <StaggerItem as="li" key={i} className="flex gap-4 text-body text-ink">
              <span className="tabular mt-0.5 w-6 shrink-0 text-caption text-ink-faint">{i + 1}</span>
              <span>{statement}</span>
            </StaggerItem>
          ))}
        </Stagger>
        {nextAllowedAt ? (
          <p className="mt-6 text-caption text-ink-muted">
            A new report is available after{' '}
            <span className="tabular text-ink">{formatDate(nextAllowedAt)}</span>, or as
            soon as fifty more reviews have been added.
          </p>
        ) : null}
      </Section>

      <Section
        title="How fast you forget"
        aside={
          <span>
            <span className="tabular text-ink">{daysWord(curve.stabilityDays.yours)}</span> to 90%,
            against <span className="tabular">{daysWord(curve.stabilityDays.population)}</span>
          </span>
        }
      >
        <p className="mb-5 max-w-[64ch] text-ui text-ink-muted">
          One new card, answered Good once, and the chance of recalling it over the
          days that follow. The dashed line is the published average; the solid one is
          you.
        </p>
        <CompareCurves yours={curve.yours} population={curve.population} yoursLabel={sourceLabel} />
      </Section>

      <Section
        title="The fit"
        aside={
          model.fitted ? (
            model.adopted ? <Badge tone="info">In use</Badge> : <Badge>Not adopted</Badge>
          ) : undefined
        }
      >
        {model.fitted && model.baseline && model.candidate ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <table className="w-full text-ui">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="eyebrow py-2 pr-3 font-medium">Measure</th>
                  <th className="eyebrow px-3 py-2 text-right font-medium">Defaults</th>
                  <th className="eyebrow py-2 pl-3 text-right font-medium">Fitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <Row
                  label="Prediction error (log loss)"
                  note="Lower is better. 0.693 is a coin flip."
                  before={model.baseline.logLoss.toFixed(4)}
                  after={model.candidate.logLoss.toFixed(4)}
                />
                <Row
                  label="Calibration error"
                  note="Gap between predicted and actual recall."
                  before={formatPercent(model.baseline.calibrationError)}
                  after={formatPercent(model.candidate.calibrationError)}
                />
                <Row
                  label="Mean interval"
                  before={`${model.baseline.averageIntervalDays.toFixed(1)}d`}
                  after={`${model.candidate.averageIntervalDays.toFixed(1)}d`}
                />
                <Row
                  label="Estimated reviews a day"
                  before={model.baseline.estimatedReviewsPerDay.toFixed(1)}
                  after={model.candidate.estimatedReviewsPerDay.toFixed(1)}
                />
              </tbody>
            </table>
            <div className="self-start rounded-lg border border-line bg-surface px-5 py-4">
              <p className="text-ui text-ink">
                Predicts your recall{' '}
                <span className="tabular">{formatPercent(Math.abs(model.lossImprovement ?? 0))}</span>{' '}
                {(model.lossImprovement ?? 0) >= 0 ? 'better' : 'worse'} than the defaults, and
                implies{' '}
                <span className={cn('tabular', (model.workloadChange ?? 0) > 0 && 'text-accent')}>
                  {formatPercent(Math.abs(model.workloadChange ?? 0))}{' '}
                  {(model.workloadChange ?? 0) > 0 ? 'more' : 'fewer'}
                </span>{' '}
                reviews a day. Fitted from{' '}
                <span className="tabular">{formatCount(model.reviewsUsed)}</span> reviews.
              </p>
              {model.adopted ? (
                <p className="mt-3 text-caption text-ink-muted">
                  Your cards are already scheduled with these parameters.
                </p>
              ) : (
                <div className="mt-4">
                  <Button
                    variant="primary"
                    loading={apply.isPending}
                    onClick={() =>
                      apply.mutate([...(model.params ?? [])], {
                        onSuccess: () =>
                          toast.success(
                            'Fitted parameters adopted. They apply from each card’s next review.',
                          ),
                        onError: (error) => toast.error(messageOf(error)),
                      })
                    }
                  >
                    Adopt these parameters
                  </Button>
                  <p className="mt-2 text-caption text-ink-muted">
                    Reversible from the stats page at any time.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="max-w-[64ch] text-ui text-ink-muted">
            Nothing was fitted: below the minimum history a fit follows noise. The
            published defaults
            {model.baseline
              ? ` predicted your answers within ${formatPercent(model.baseline.calibrationError)} of what happened, over ${formatCount(model.baseline.predictions)} predictions.`
              : ' could not be scored yet: every review so far was a card’s first.'}
          </p>
        )}
      </Section>

      <Section title="When you remember">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div>
            <p className="eyebrow mb-3">By hour, your time</p>
            <PatternBars
              buckets={patterns.hours.map((b) => ({
                label: HOUR_LABELS[b.hour]!,
                reviews: b.reviews,
                retention: b.retention,
              }))}
              labelEvery={3}
              summary={
                patterns.bestHour !== null
                  ? `Reviews by hour of day. Recall is highest around ${HOUR_LABELS[patterns.bestHour]}.`
                  : 'Reviews by hour of day. No hour has enough answers yet to compare.'
              }
            />
          </div>
          <div>
            <p className="eyebrow mb-3">By weekday</p>
            <PatternBars
              buckets={patterns.weekdays.map((b) => ({
                label: WEEKDAY_LABELS[b.weekday]!,
                reviews: b.reviews,
                retention: b.retention,
              }))}
              summary="Reviews by day of the week, and how much of them was recalled."
            />
          </div>
        </div>
      </Section>

      <Section
        title="Cards that keep failing"
        aside={leeches.length > 0 ? `${leeches.length} shown, most lapses first` : undefined}
      >
        {leeches.length === 0 ? (
          <p className="text-ui text-ink-muted">
            No card has been forgotten three times. Nothing here is costing you.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="hidden grid-cols-[minmax(0,1fr)_72px_72px_88px_96px] gap-4 border-b border-line px-5 py-2.5 md:grid">
              <span className="eyebrow">Card</span>
              <span className="eyebrow text-right">Lapses</span>
              <span className="eyebrow text-right">Reviews</span>
              <span className="eyebrow text-right">Minutes</span>
              <span className="eyebrow text-right">Recall now</span>
            </div>
            <ul className="divide-y divide-line">
              {leeches.map((leech) => (
                <li
                  key={leech.cardId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_72px_72px_88px_96px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ui text-ink">{leech.front}</p>
                    <p className="truncate text-caption text-ink-muted">
                      <Link href={`/decks/${leech.deckId}`} className="underline-offset-4 hover:underline">
                        {leech.deckTitle}
                      </Link>
                      {leech.lastRating ? ` , last answer ${RATING_NAME[leech.lastRating]}` : ''}
                    </p>
                    <p className="tabular mt-0.5 text-caption text-ink-muted md:hidden">
                      {leech.lapses} lapses, {leech.reviews} reviews, {Math.round(leech.minutesSpent)} min
                    </p>
                  </div>
                  <span className="tabular hidden text-right text-ui text-accent md:block">{leech.lapses}</span>
                  <span className="tabular hidden text-right text-ui text-ink md:block">{leech.reviews}</span>
                  <span className="tabular hidden text-right text-ui text-ink md:block">
                    {Math.round(leech.minutesSpent)}
                  </span>
                  <div className="flex justify-end">
                    <Recall value={leech.retrievability} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="What each deck returns" aside={`Last ${report.windowDays} days`}>
        {decks.length === 0 ? (
          <p className="text-ui text-ink-muted">No decks with cards.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="hidden grid-cols-[minmax(0,1fr)_72px_88px_88px_96px_96px] gap-4 border-b border-line px-5 py-2.5 md:grid">
              <span className="eyebrow">Deck</span>
              <span className="eyebrow text-right">Cards</span>
              <span className="eyebrow text-right">Reviews</span>
              <span className="eyebrow text-right">Per card</span>
              <span className="eyebrow text-right">Recalled</span>
              <span className="eyebrow text-right">Predicted</span>
            </div>
            <ul className="divide-y divide-line">
              {decks.map((deck) => (
                <li
                  key={deck.deckId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_72px_88px_88px_96px_96px]"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/decks/${deck.deckId}`}
                      className="block truncate text-ui font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {deck.title}
                    </Link>
                    <p className="tabular mt-0.5 text-caption text-ink-muted md:hidden">
                      {formatCount(deck.cards)} cards, {formatCount(deck.reviews)} reviews,{' '}
                      {deck.retention === null ? 'nothing recalled yet' : `${formatPercent(deck.retention)} recalled`}
                    </p>
                  </div>
                  <span className="tabular hidden text-right text-ui text-ink md:block">{formatCount(deck.cards)}</span>
                  <span className="tabular hidden text-right text-ui text-ink md:block">{formatCount(deck.reviews)}</span>
                  <span className="tabular hidden text-right text-ui text-ink md:block">{deck.reviewsPerCard.toFixed(1)}</span>
                  <span className="tabular hidden text-right text-ui text-ink md:block">
                    {deck.retention === null ? 'n/a' : formatPercent(deck.retention)}
                  </span>
                  <div className="flex justify-end">
                    <Recall value={deck.predictedRetention} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-caption text-ink-muted">
          Recalled is what you actually remembered when asked; predicted is the model&rsquo;s
          mean recall across the deck right now.{' '}
          <LinkButton href="/stats" variant="ghost" size="sm" className="-ml-2">
            Exam-day forecast on the stats page
          </LinkButton>
        </p>
      </Section>
    </div>
  );
}

function Row({
  label,
  note,
  before,
  after,
}: {
  label: string;
  note?: string;
  before: string;
  after: string;
}) {
  return (
    <tr>
      <td className="py-3 pr-3">
        <span className="text-ink">{label}</span>
        {note ? <span className="block text-caption text-ink-faint">{note}</span> : null}
      </td>
      <td className="tabular px-3 py-3 text-right text-ink-muted">{before}</td>
      <td className="tabular py-3 pl-3 text-right text-ink">{after}</td>
    </tr>
  );
}
