import { ApiError, NetworkError, formatPercent } from '@recallify/core';
import { memoryLevel, type MemoryLevel } from '@recallify/tokens';
import type { ReactNode } from 'react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { cn } from '@/lib/cn';
import { Button } from './button';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong bg-surface-alt px-1 text-[11px] leading-none text-ink-muted">
      {children}
    </kbd>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'danger';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm border px-1.5 text-[11px] font-medium leading-none',
        tone === 'neutral' && 'border-line-strong text-ink-muted',
        tone === 'info' && 'border-info/40 text-info',
        tone === 'danger' && 'border-danger/40 text-danger',
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATE_LABEL = {
  NEW: 'New',
  LEARNING: 'Learning',
  REVIEW: 'Review',
  RELEARNING: 'Relearning',
} as const;

export function StateBadge({ state }: { state: keyof typeof STATE_LABEL }) {
  return <Badge>{STATE_LABEL[state]}</Badge>;
}

const LEVEL_CLASS: Record<MemoryLevel, string> = {
  strong: 'bg-mem-strong',
  good: 'bg-mem-good',
  fading: 'bg-mem-fading',
  weak: 'bg-mem-weak',
  lost: 'bg-mem-lost',
};

export const LEVEL_TEXT_CLASS: Record<MemoryLevel, string> = {
  strong: 'text-mem-strong',
  good: 'text-mem-good',
  fading: 'text-mem-fading',
  weak: 'text-mem-weak',
  lost: 'text-mem-lost',
};

/**
 * Predicted recall as a number with its band on the memory scale beside it.
 * The number carries the meaning; the colour repeats it.
 */
export function Recall({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  if (value === null) {
    return <span className={cn('tabular text-ui text-ink-faint', className)}>n/a</span>;
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        aria-hidden
        className={cn('size-2 rounded-full', LEVEL_CLASS[memoryLevel(value)])}
      />
      <span className="tabular text-ui text-ink">{formatPercent(value)}</span>
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <StaggerItem
      className={cn(
        'group flex flex-col gap-1 bg-surface px-4 py-4 transition-colors duration-300 hover:bg-paper sm:px-5',
        className,
      )}
    >
      <span className="eyebrow">{label}</span>
      <span className="tabular text-data-lg font-medium text-ink">{value}</span>
      {sub ? <span className="text-caption text-ink-muted">{sub}</span> : null}
    </StaggerItem>
  );
}

/**
 * A bordered group of tiles that share hairlines instead of each being a card.
 * The hairlines are the container showing through 1px gaps, so they stay right
 * at any column count. An odd tile out on a phone takes the full row.
 */
export function StatStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Stagger
      gap={0.08}
      delay={0.1}
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line',
        '[&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1',
        className,
      )}
    >
      {children}
    </Stagger>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong px-6 py-10',
        className,
      )}
    >
      <h3 className="font-display text-h2 font-semibold text-ink">{title}</h3>
      <p className="max-w-[52ch] text-ui text-ink-muted">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </Reveal>
  );
}

/** What happened, whether anything was lost, and what to do next. */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const offline = error instanceof NetworkError;
  const traceId = error instanceof ApiError ? error.traceId : undefined;
  const message = offline
    ? 'The server could not be reached. Check your connection. Nothing you saved earlier is affected.'
    : error instanceof Error
      ? error.message
      : 'Something went wrong while loading this.';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-line px-6 py-8',
        className,
      )}
    >
      <h3 className="text-h3 font-semibold text-ink">
        {offline ? 'You appear to be offline' : 'This did not load'}
      </h3>
      <p className="max-w-[60ch] text-ui text-ink-muted">{message}</p>
      {traceId ? (
        <p className="text-caption text-ink-faint">
          Reference <span className="tabular">{traceId}</span>
        </p>
      ) : null}
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** A message for a toast or an inline error, from whatever was thrown. */
export function messageOf(error: unknown): string {
  if (error instanceof NetworkError)
    return 'Could not reach the server. Check your connection.';
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
