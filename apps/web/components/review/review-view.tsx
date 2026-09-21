'use client';

import type { QueueCard } from '@recallify/contracts';
import {
  currentCard,
  describeInterval,
  formatDate,
  formatInterval,
  formatPercent,
  keys,
  previewIntervals,
  progress,
  rate,
  reveal,
  startSession,
  toFsrsConfig,
  type SessionState,
} from '@recallify/core';
import { useQueue } from '@recallify/core/react';
import { explain, type FsrsConfig, type Rating } from '@recallify/fsrs';
import { memoryLevel } from '@recallify/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CountUp, EASE } from '@/components/motion';
import { Button, LinkButton, buttonStyles } from '@/components/ui/button';
import {
  ErrorState,
  Kbd,
  LEVEL_TEXT_CLASS,
  Skeleton,
  StateBadge,
} from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useReviewOutbox } from '@/lib/use-review-outbox';

const RATINGS = [
  { rating: 1, key: 'again', label: 'Again', hotkey: '1' },
  { rating: 2, key: 'hard', label: 'Hard', hotkey: '2' },
  { rating: 3, key: 'good', label: 'Good', hotkey: '3' },
  { rating: 4, key: 'easy', label: 'Easy', hotkey: '4' },
] as const;

const RISE = {
  hidden: { opacity: 0, y: 24 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

const BORDER = {
  strong: 'border-l-mem-strong',
  good: 'border-l-mem-good',
  fading: 'border-l-mem-fading',
  weak: 'border-l-mem-weak',
  lost: 'border-l-mem-lost',
} as const;

export function ReviewView() {
  const params = useSearchParams();
  const deckId = params.get('deck') ?? undefined;
  const ahead = params.get('ahead') === '1';

  const queue = useQueue(deckId, ahead);
  const queryClient = useQueryClient();
  const outbox = useReviewOutbox();

  const [session, setSession] = useState<SessionState | null>(null);
  const [config, setConfig] = useState<FsrsConfig | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const shownAt = useRef(Date.now());

  // A session works through the queue it started with.
  useEffect(() => {
    if (queue.data && session === null) {
      setSession(startSession(queue.data.cards));
      setConfig(toFsrsConfig(queue.data.config));
      shownAt.current = Date.now();
    }
  }, [queue.data, session]);

  const card = session ? currentCard(session) : null;
  // An empty queue is "nothing due", not a session that finished.
  const finished = session !== null && card === null && session.initialCount > 0;

  // The rest of the app is stale the moment a session ends.
  useEffect(() => {
    if (!finished) return;
    void queryClient.invalidateQueries({ queryKey: keys.stats.all });
    void queryClient.invalidateQueries({ queryKey: keys.decks.all });
    void queryClient.invalidateQueries({ queryKey: keys.cards.all });
  }, [finished, queryClient]);

  const onReveal = useCallback(() => setSession((s) => (s ? reveal(s) : s)), []);

  const onRate = useCallback(
    (rating: Rating) => {
      if (!session || !config || !session.revealed) return;
      const now = new Date();
      const result = rate(session, rating, now, config);
      if (!result) return;

      // Local first: the next card is on screen before the request has left.
      setSession(result.state);
      outbox.record({
        id: crypto.randomUUID(),
        cardId: result.submission.cardId,
        rating,
        reviewedAt: now.toISOString(),
        durationMs: Math.min(600_000, Date.now() - shownAt.current),
      });
      shownAt.current = Date.now();
    },
    [session, config, outbox],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.key === ' ' || event.key === 'Enter') {
        if (session && !session.revealed && card) {
          event.preventDefault();
          onReveal();
        }
        return;
      }
      if (event.key.toLowerCase() === 'w') {
        setShowWhy((v) => !v);
        return;
      }
      const hit = RATINGS.find((r) => r.hotkey === event.key);
      if (hit && session?.revealed) {
        event.preventDefault();
        onRate(hit.rating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, card, onReveal, onRate]);

  const exitHref = deckId ? `/decks/${deckId}` : '/today';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper">
        <div className="mx-auto flex h-14 max-w-[880px] items-center gap-4 px-4 sm:px-6">
          <Link
            href={exitHref}
            aria-label="Leave the session"
            className="flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-alt hover:text-ink"
          >
            <X className="size-5" />
          </Link>
          <div
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={session ? Math.round(progress(session) * 100) : 0}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
          >
            <motion.div
              className="h-full origin-left rounded-full bg-accent"
              initial={false}
              animate={{ scaleX: session ? progress(session) : 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
          <span className="tabular min-w-14 text-right text-ui text-ink-muted">
            {session ? `${session.queue.length} left` : ''}
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-4 sm:px-6">
        {queue.isLoading || (queue.data && !session) ? (
          <div className="flex flex-1 flex-col justify-center gap-4 py-10">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="mx-auto h-12 w-48" />
          </div>
        ) : queue.isError ? (
          <div className="py-10">
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
          </div>
        ) : finished && session ? (
          <Finished
            session={session}
            pending={outbox.pending}
            exitHref={exitHref}
            deckId={deckId}
          />
        ) : card && session && config ? (
          <>
            <div className="flex flex-1 flex-col justify-center py-6 sm:py-10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${card.id}-${card.reps}`}
                  // The answered card is thrown off to the left; the next
                  // one is dealt in from the right, slightly turned.
                  initial={{ opacity: 0, x: 90, rotate: 2.5, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    x: -90,
                    rotate: -2.5,
                    scale: 0.96,
                    transition: { duration: 0.22, ease: 'easeIn' },
                  }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <FlipCard card={card} revealed={session.revealed} onReveal={onReveal} />
                  <AnimatePresence initial={false}>
                    {showWhy ? <WhyPanel card={card} config={config} /> : null}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-8">
              {session.revealed ? (
                <RatingBar card={card} config={config} onRate={onRate} />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full sm:w-64"
                    onClick={onReveal}
                  >
                    Show answer
                  </Button>
                  <p className="hidden text-caption text-ink-faint sm:block">
                    <Kbd>Space</Kbd> to show the answer, <Kbd>W</Kbd> for why this card is
                    here
                  </p>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-caption text-ink-faint">
                <button
                  type="button"
                  onClick={() => setShowWhy((v) => !v)}
                  aria-expanded={showWhy}
                  className="underline-offset-4 hover:text-ink hover:underline"
                >
                  {showWhy ? 'Hide the reasoning' : 'Why this card?'}
                </button>
                {outbox.pending > 0 ? (
                  <span
                    className="inline-flex items-center gap-1.5"
                    title="Kept on this device and sent when the connection returns"
                  >
                    <CloudOff className="size-3.5" />
                    <span className="tabular">{outbox.pending}</span> waiting to sync
                  </span>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <NothingDue ahead={ahead} deckId={deckId} exitHref={exitHref} />
        )}
      </div>
    </div>
  );
}

function FlipCard({
  card,
  revealed,
  onReveal,
}: {
  card: QueueCard;
  revealed: boolean;
  onReveal: () => void;
}) {
  const isNew = card.state === 'NEW';
  const edge = isNew ? 'border-l-line-strong' : BORDER[memoryLevel(card.retrievability)];
  const face = cn(
    'flip-face col-start-1 row-start-1 flex min-h-[260px] flex-col rounded-lg border border-line border-l-4 bg-surface px-5 py-6 sm:min-h-[320px] sm:px-10 sm:py-9',
    edge,
  );

  const meta = (
    <div className="flex items-center justify-between gap-3 text-caption text-ink-faint">
      <span className="truncate">{card.deckTitle}</span>
      <span className="flex shrink-0 items-center gap-2">
        <StateBadge state={card.state} />
        {!isNew ? (
          <span
            className={cn('tabular', LEVEL_TEXT_CLASS[memoryLevel(card.retrievability)])}
          >
            {formatPercent(card.retrievability)}
          </span>
        ) : null}
      </span>
    </div>
  );

  return (
    <div className="flip-scene">
      {/* Both faces share one grid cell, so the card is as tall as the taller
          side and nothing jumps when it turns. */}
      <motion.div
        className="grid [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      >
        <div
          className={cn(face, !revealed && 'cursor-pointer')}
          aria-hidden={revealed}
          onClick={() => !revealed && onReveal()}
        >
          {meta}
          <p className="font-display my-auto whitespace-pre-wrap break-words py-6 text-center text-[clamp(20px,4vw,34px)] leading-[1.25] text-ink">
            {card.front}
          </p>
          {card.hint ? (
            <p className="text-center text-ui text-ink-muted">Hint: {card.hint}</p>
          ) : (
            <span />
          )}
        </div>

        <div className={cn(face, '[transform:rotateY(180deg)]')} aria-hidden={!revealed}>
          {meta}
          {/* Question and answer sit together in the middle, the way the
              question alone did on the other side. */}
          <div className="my-auto py-6">
            <p className="whitespace-pre-wrap break-words text-center text-ui text-ink-muted">
              {card.front}
            </p>
            <div className="mx-auto my-4 h-px w-12 bg-line-strong" />
            <p className="font-display whitespace-pre-wrap break-words text-center text-[clamp(20px,4vw,34px)] leading-[1.25] text-ink">
              {card.back}
            </p>
          </div>
          <span />
        </div>
      </motion.div>
    </div>
  );
}

function RatingBar({
  card,
  config,
  onRate,
}: {
  card: QueueCard;
  config: FsrsConfig;
  onRate: (rating: Rating) => void;
}) {
  // The same scheduler the server runs, so these are what will happen, give or
  // take the few percent of jitter only the server adds.
  const preview = previewIntervals(card, new Date(), config);

  return (
    <div
      role="group"
      aria-label="How well did you remember?"
      className="grid grid-cols-4 gap-2 sm:gap-3"
    >
      {RATINGS.map(({ rating, key, label, hotkey }, i) => (
        <motion.button
          key={key}
          type="button"
          onClick={() => onRate(rating)}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.45, ease: EASE, delay: i * 0.05 }}
          className={cn(
            'group flex h-16 flex-col items-center justify-center gap-0.5 rounded-md border',
            'transition-colors duration-200',
            rating === 3
              ? 'border-ink bg-ink text-paper hover:border-accent hover:bg-accent'
              : 'border-line-strong bg-surface text-ink hover:border-ink',
          )}
        >
          <span className="text-ui font-medium">{label}</span>
          <span
            className={cn(
              'tabular text-caption',
              rating === 3 ? 'text-paper/70' : 'text-ink-muted',
            )}
          >
            {formatInterval(preview[key])}
          </span>
          <span className="sr-only">, key {hotkey}</span>
        </motion.button>
      ))}
      <p className="col-span-4 hidden text-center text-caption text-ink-faint sm:block">
        <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> <Kbd>4</Kbd> to answer. The time under each
        is when the card comes back.
      </p>
    </div>
  );
}

/**
 * "Why is this card in front of me?"
 *
 * Computed here, in the browser, by the same pure engine the server runs. No
 * request: the panel opens instantly and works with no connection at all.
 */
function WhyPanel({ card, config }: { card: QueueCard; config: FsrsConfig }) {
  const now = new Date();
  const isNew = card.state === 'NEW';
  const detail = explain(card, now, config);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4, ease: EASE }}
      aria-label="Why this card"
      className="mt-4 rounded-lg border border-line bg-surface px-5 py-4"
    >
      {isNew ? (
        <p className="text-ui text-ink-muted">
          This card is new. There is no memory of it to measure yet, so it is here because
          your daily limit for new cards has room for it. Your first answer sets its
          starting stability.
        </p>
      ) : (
        <>
          <p className="text-ui text-ink-muted">
            You last saw this{' '}
            <span className="tabular text-ink">
              {describeInterval(detail.elapsedDays)}
            </span>{' '}
            ago. The model puts your chance of recalling it right now at{' '}
            <span
              className={cn(
                'tabular',
                LEVEL_TEXT_CLASS[memoryLevel(detail.retrievability)],
              )}
            >
              {formatPercent(detail.retrievability)}
            </span>
            , and your target is{' '}
            <span className="tabular text-ink">
              {formatPercent(config.desiredRetention)}
            </span>
            .
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <WhyFact term="Stability" value={describeInterval(detail.stability)} />
            <WhyFact term="Difficulty" value={`${detail.difficulty.toFixed(1)} / 10`} />
            <WhyFact term="Reviews" value={`${card.reps}, ${card.lapses} lapsed`} />
            <WhyFact
              term="Falls below target"
              value={formatDate(detail.predictedForgetAt)}
            />
          </dl>
        </>
      )}
    </motion.section>
  );
}

function WhyFact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-ink-muted">{term}</dt>
      <dd className="tabular mt-0.5 text-ui text-ink">{value}</dd>
    </div>
  );
}

function Finished({
  session,
  pending,
  exitHref,
  deckId,
}: {
  session: SessionState;
  pending: number;
  exitHref: string;
  deckId: string | undefined;
}) {
  const { tally } = session;
  const recalled = tally.reviewed - tally.again;

  return (
    <motion.div
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
      }}
      className="flex flex-1 flex-col justify-center py-10"
    >
      {/* A ring that closes and a tick that is drawn: the session, finished. */}
      <svg
        viewBox="0 0 56 56"
        aria-hidden
        className="mb-6 size-14 text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.circle
          cx="28"
          cy="28"
          r="25"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
        />
        <motion.path
          d="M17 29l8 8 15-17"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.75, ease: 'easeOut' }}
        />
      </svg>
      <motion.p variants={RISE} className="eyebrow">
        Session complete
      </motion.p>
      <motion.h1
        variants={RISE}
        className="font-display mt-2 text-[clamp(32px,5vw,56px)] font-semibold leading-[1.02] text-ink"
      >
        <CountUp value={tally.reviewed} className="tabular" /> reviewed,{' '}
        <CountUp value={tally.again} className="tabular" />{' '}
        {tally.again === 1 ? 'lapse' : 'lapses'}.
      </motion.h1>
      <motion.p variants={RISE} className="mt-3 text-ui text-ink-muted">
        {tally.reviewed > 0
          ? `You recalled ${formatPercent(recalled / tally.reviewed)} of what you were shown. Every card has been rescheduled from your answers.`
          : 'Nothing was answered this time.'}
      </motion.p>

      <motion.dl
        variants={RISE}
        className="mt-8 grid max-w-[480px] grid-cols-4 gap-px overflow-hidden rounded-lg border border-line bg-line"
      >
        {RATINGS.map(({ key, label }) => (
          <div key={key} className="bg-surface px-3 py-3 text-center">
            <dt className="text-caption text-ink-muted">{label}</dt>
            <dd className="tabular mt-0.5 text-h3 font-medium text-ink">
              <CountUp value={tally[key]} />
            </dd>
          </div>
        ))}
      </motion.dl>

      {pending > 0 ? (
        <p className="mt-5 inline-flex items-center gap-2 text-ui text-ink-muted">
          <CloudOff className="size-4" />
          <span>
            <span className="tabular text-ink">{pending}</span> answers are saved on this
            device and will be sent when the connection returns. Nothing is lost.
          </span>
        </p>
      ) : null}

      <motion.div variants={RISE} className="mt-8 flex flex-col gap-2 sm:flex-row">
        <LinkButton href={exitHref} variant="primary" size="lg">
          {deckId ? 'Back to the deck' : 'Back to today'}
        </LinkButton>
        <LinkButton href="/stats" size="lg">
          See your stats
        </LinkButton>
      </motion.div>
    </motion.div>
  );
}

function NothingDue({
  ahead,
  deckId,
  exitHref,
}: {
  ahead: boolean;
  deckId: string | undefined;
  exitHref: string;
}) {
  const aheadHref = `/review?ahead=1${deckId ? `&deck=${deckId}` : ''}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="flex flex-1 flex-col justify-center py-10"
    >
      <h1 className="font-display text-[clamp(32px,5vw,56px)] font-semibold leading-[1.02] text-ink">
        {ahead ? 'There are no cards to study.' : 'Nothing is due.'}
      </h1>
      <p className="mt-2 max-w-[56ch] text-ui text-ink-muted">
        {ahead
          ? 'Add some cards to this deck first.'
          : 'Every card is scheduled for later, or today’s limits are used up. Reviewing early is allowed, but it buys less than reviewing on time.'}
      </p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <LinkButton href={exitHref} variant="primary" size="lg">
          {deckId ? 'Back to the deck' : 'Back to today'}
        </LinkButton>
        {!ahead ? (
          // A full navigation, so the new queue is fetched from scratch.
          <a href={aheadHref} className={buttonStyles('secondary', 'lg')}>
            Study ahead anyway
          </a>
        ) : null}
      </div>
    </motion.div>
  );
}
