import type { OptimizerEvaluation } from '@recallify/contracts';
import { formatPercent } from '@recallify/core';
import { cn } from '@/lib/cn';

/**
 * The published defaults against a fit, on the same history. The optimizer
 * proposal on the stats page and the Memory Report show the same four
 * measures, from here, so they cannot drift apart in label or rounding.
 * `inset` pads the outer columns for a table drawn inside a bordered card.
 */
export function FitTable({
  baseline,
  candidate,
  inset = false,
}: {
  baseline: OptimizerEvaluation;
  candidate: OptimizerEvaluation;
  inset?: boolean;
}) {
  const edge = inset ? 'px-5' : '';
  return (
    <table className="w-full text-ui">
      <thead>
        <tr className="border-b border-line text-left">
          <th className={cn('eyebrow py-2 pr-3 font-medium', edge)}>Measure</th>
          <th className="eyebrow px-3 py-2 text-right font-medium">Defaults</th>
          <th className={cn('eyebrow py-2 pl-3 text-right font-medium', edge)}>Fitted</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        <Row
          label="Prediction error (log loss)"
          note="Lower is better. 0.693 is a coin flip."
          before={baseline.logLoss.toFixed(4)}
          after={candidate.logLoss.toFixed(4)}
          edge={edge}
        />
        <Row
          label="Calibration error"
          note="Gap between predicted and actual recall."
          before={formatPercent(baseline.calibrationError)}
          after={formatPercent(candidate.calibrationError)}
          edge={edge}
        />
        <Row
          label="Mean interval"
          before={`${baseline.averageIntervalDays.toFixed(1)}d`}
          after={`${candidate.averageIntervalDays.toFixed(1)}d`}
          edge={edge}
        />
        <Row
          label="Estimated reviews a day"
          before={baseline.estimatedReviewsPerDay.toFixed(1)}
          after={candidate.estimatedReviewsPerDay.toFixed(1)}
          edge={edge}
        />
      </tbody>
    </table>
  );
}

function Row({
  label,
  note,
  before,
  after,
  edge,
}: {
  label: string;
  note?: string;
  before: string;
  after: string;
  edge: string;
}) {
  return (
    <tr>
      <td className={cn('py-3 pr-3', edge)}>
        <span className="text-ink">{label}</span>
        {note ? <span className="block text-caption text-ink-faint">{note}</span> : null}
      </td>
      <td className="tabular px-3 py-3 text-right text-ink-muted">{before}</td>
      <td className={cn('tabular py-3 pl-3 text-right text-ink', edge)}>{after}</td>
    </tr>
  );
}
