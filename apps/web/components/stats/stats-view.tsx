'use client';

import type { OptimizerRunResponse } from '@recallify/contracts';
import { formatCount, formatDate, formatPercent } from '@recallify/core';
import {
  useApplyParams,
  useForecast,
  useHeatmap,
  useMe,
  useOptimizerStatus,
  useOverview,
  useRunOptimizer,
} from '@recallify/core/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ForecastBars } from '@/components/charts/forecast-bars';
import { Heatmap } from '@/components/charts/heatmap';
import { CountUp, FillBar } from '@/components/motion';
import { PageShell, Section } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import {
  ErrorState,
  Skeleton,
  StatStrip,
  StatTile,
  messageOf,
} from '@/components/ui/misc';
import { cn } from '@/lib/cn';

export function StatsView() {
  const me = useMe();
  const overview = useOverview();
  const heatmap = useHeatmap(371);
  const forecast = useForecast(30);

  const stats = overview.data;

  return (
    <PageShell
      title="Stats"
      description="Everything here is computed on the server from your review log. Nothing is estimated in the browser and nothing resets."
    >
      {overview.isError ? (
        <ErrorState
          error={overview.error}
          onRetry={() => void overview.refetch()}
          className="mb-10"
        />
      ) : (
        <StatStrip className="mb-10 sm:grid-cols-4">
          <StatTile
            label="Recalled, 30 days"
            value={
              stats ? (
                stats.totalReviews > 0 ? (
                  <CountUp value={stats.retention} format={formatPercent} />
                ) : (
                  'n/a'
                )
              ) : (
                <Skeleton className="h-7 w-16" />
              )
            }
            sub={
              me.data
                ? `Target ${formatPercent(me.data.desiredRetention)}. First reviews are not counted.`
                : undefined
            }
          />
          <StatTile
            label="Streak"
            value={
              stats ? (
                <CountUp value={stats.streak} format={(n) => `${Math.round(n)}d`} />
              ) : (
                <Skeleton className="h-7 w-12" />
              )
            }
            sub={stats ? `Longest ${stats.longestStreak}d` : undefined}
          />
          <StatTile
            label="Reviews"
            value={
              stats ? (
                <CountUp
                  value={stats.totalReviews}
                  format={(n) => formatCount(Math.round(n))}
                />
              ) : (
                <Skeleton className="h-7 w-16" />
              )
            }
            sub={stats ? `${formatCount(stats.totalCards)} cards` : undefined}
          />
          <StatTile
            label="Level"
            value={
              stats ? <CountUp value={stats.level} /> : <Skeleton className="h-7 w-10" />
            }
            sub={stats ? `${formatCount(stats.xp)} xp, never reset` : undefined}
          />
        </StatStrip>
      )}

      <Section title="The last year" className="mb-10">
        {heatmap.isLoading ? (
          <Skeleton className="h-[130px] w-full" />
        ) : heatmap.isError ? (
          <ErrorState error={heatmap.error} onRetry={() => void heatmap.refetch()} />
        ) : (
          <Heatmap days={heatmap.data?.days ?? []} />
        )}
      </Section>

      <Section
        title="The next 30 days"
        className="mb-10"
        aside={
          forecast.data && forecast.data.backlog > 0 ? (
            <span>
              <span className="tabular text-ink">{forecast.data.backlog}</span> already
              overdue, counted in today
            </span>
          ) : undefined
        }
      >
        {forecast.isLoading ? (
          <Skeleton className="h-[140px] w-full" />
        ) : forecast.isError ? (
          <ErrorState error={forecast.error} onRetry={() => void forecast.refetch()} />
        ) : (
          <ForecastBars days={forecast.data?.days ?? []} height={140} />
        )}
      </Section>

      <MemoryModel />
    </PageShell>
  );
}

/**
 * The optimizer.
 *
 * It fits the 21 FSRS parameters to this one person's review log. The honest
 * framing is on the screen, not in a footnote: it buys accuracy, and the
 * workload it implies is reported in whichever direction it actually goes.
 */
function MemoryModel() {
  const status = useOptimizerStatus();
  const run = useRunOptimizer();
  const apply = useApplyParams();
  const [result, setResult] = useState<OptimizerRunResponse | null>(null);

  const s = status.data;

  return (
    <Section title="Your memory model">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <p className="max-w-[60ch] text-ui text-ink-muted">
            Recallify starts everyone on the published FSRS parameters, fitted to millions
            of reviews by other people. Once you have enough history, it can fit them to
            yours. The result predicts your memory more accurately. It does not promise
            fewer reviews: for someone who forgets quickly the honest answer is more of
            them.
          </p>

          {status.isLoading ? (
            <Skeleton className="mt-5 h-16 w-full" />
          ) : status.isError ? (
            <ErrorState
              error={status.error}
              onRetry={() => void status.refetch()}
              className="mt-5"
            />
          ) : s ? (
            <div className="mt-5">
              <div className="flex items-baseline justify-between text-caption text-ink-muted">
                <span>
                  <span className="tabular text-ink">{formatCount(s.reviewCount)}</span>{' '}
                  of <span className="tabular">{formatCount(s.minimumReviews)}</span>{' '}
                  reviews needed
                </span>
                <span>
                  {s.usingOptimizedParams
                    ? 'Using your fitted parameters'
                    : 'Using the defaults'}
                </span>
              </div>
              <FillBar className="mt-2" ratio={s.reviewCount / s.minimumReviews} />

              {!s.eligible ? (
                <p className="mt-3 text-caption text-ink-muted">
                  Below {s.minimumReviews} reviews a fit follows noise and does worse than
                  the defaults, so it is not offered yet.
                </p>
              ) : s.nextRunAllowedAt ? (
                <p className="mt-3 text-caption text-ink-muted">
                  Fitted recently. Another run is available after{' '}
                  <span className="tabular text-ink">
                    {formatDate(s.nextRunAllowedAt)}
                  </span>
                  .
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  disabled={!s.eligible || Boolean(s.nextRunAllowedAt)}
                  loading={run.isPending}
                  onClick={() =>
                    run.mutate(undefined, {
                      onSuccess: setResult,
                      onError: (error) => toast.error(messageOf(error)),
                    })
                  }
                >
                  {run.isPending
                    ? 'Fitting, this takes a few seconds'
                    : 'Fit to my history'}
                </Button>
                {s.usingOptimizedParams ? (
                  <Button
                    loading={apply.isPending && !result}
                    onClick={() =>
                      apply.mutate(null, {
                        onSuccess: () => toast.success('Back on the published defaults.'),
                        onError: (error) => toast.error(messageOf(error)),
                      })
                    }
                  >
                    Return to defaults
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="rounded-lg border border-line bg-surface">
            <div className="border-b border-line px-5 py-3">
              <p className="text-ui font-medium text-ink">
                Proposed fit. Nothing is saved yet.
              </p>
              <p className="text-caption text-ink-muted">
                From <span className="tabular">{formatCount(result.reviewsUsed)}</span>{' '}
                reviews, in <span className="tabular">{result.iterations}</span> steps
                {result.converged ? '' : ', stopped at the step limit'}.
              </p>
            </div>
            <table className="w-full text-ui">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="eyebrow px-5 py-2 font-medium">Measure</th>
                  <th className="eyebrow px-3 py-2 text-right font-medium">Defaults</th>
                  <th className="eyebrow px-5 py-2 text-right font-medium">Fitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <Row
                  label="Prediction error (log loss)"
                  note="Lower is better. 0.693 is a coin flip."
                  before={result.baseline.logLoss.toFixed(4)}
                  after={result.candidate.logLoss.toFixed(4)}
                />
                <Row
                  label="Calibration error"
                  note="Gap between predicted and actual recall."
                  before={formatPercent(result.baseline.calibrationError)}
                  after={formatPercent(result.candidate.calibrationError)}
                />
                <Row
                  label="Mean interval"
                  before={`${result.baseline.averageIntervalDays.toFixed(1)}d`}
                  after={`${result.candidate.averageIntervalDays.toFixed(1)}d`}
                />
                <Row
                  label="Estimated reviews a day"
                  before={result.baseline.estimatedReviewsPerDay.toFixed(1)}
                  after={result.candidate.estimatedReviewsPerDay.toFixed(1)}
                />
              </tbody>
            </table>
            <div className="border-t border-line px-5 py-4">
              <p className="text-ui text-ink">
                Predicts your recall{' '}
                <span className="tabular">
                  {formatPercent(Math.abs(result.lossImprovement))}
                </span>{' '}
                {result.lossImprovement >= 0 ? 'better' : 'worse'}, and implies{' '}
                <span
                  className={cn('tabular', result.workloadChange > 0 && 'text-accent')}
                >
                  {formatPercent(Math.abs(result.workloadChange))}{' '}
                  {result.workloadChange > 0 ? 'more' : 'fewer'}
                </span>{' '}
                reviews a day.
              </p>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setResult(null)}>
                  Discard
                </Button>
                <Button
                  variant="primary"
                  loading={apply.isPending}
                  onClick={() =>
                    apply.mutate([...result.params], {
                      onSuccess: () => {
                        toast.success(
                          'Fitted parameters adopted. They apply from each card’s next review.',
                        );
                        setResult(null);
                      },
                      onError: (error) => toast.error(messageOf(error)),
                    })
                  }
                >
                  Adopt these parameters
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden rounded-lg border border-dashed border-line-strong px-6 py-8 text-ui text-ink-muted lg:block lg:self-start">
            A comparison appears here after a fit: prediction error, calibration, mean
            interval and the daily workload, the defaults beside your own. You choose
            whether to adopt it.
          </div>
        )}
      </div>
    </Section>
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
      <td className="px-5 py-3">
        <span className="text-ink">{label}</span>
        {note ? <span className="block text-caption text-ink-faint">{note}</span> : null}
      </td>
      <td className="tabular px-3 py-3 text-right text-ink-muted">{before}</td>
      <td className="tabular px-5 py-3 text-right text-ink">{after}</td>
    </tr>
  );
}
