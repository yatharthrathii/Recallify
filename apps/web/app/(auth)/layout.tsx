import {
  DEFAULT_PARAMS,
  clamp,
  initialDifficulty,
  initialStability,
  intervalFromRetention,
  nextDifficulty,
  nextRecallStability,
  retrievability,
} from '@recallify/fsrs';
import { IntervalLadder } from '@/components/auth/interval-ladder';
import { SplitHeading } from '@/components/motion';
import { Logo } from '@/components/shell/logo';

/**
 * The gaps between the first reviews of a card answered "Good" each time, at
 * the default 90% target. Computed from the engine when the page is built, so
 * the numbers on this panel are the ones the app will actually produce.
 */
function firstIntervals(count: number): number[] {
  const params = DEFAULT_PARAMS;
  let stability = initialStability(params, 3);
  let difficulty = clamp(initialDifficulty(params, 3), 1, 10);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const interval = Math.max(
      1,
      Math.round(intervalFromRetention(params, stability, 0.9)),
    );
    out.push(interval);
    const recalledAt = retrievability(params, interval, stability);
    stability = nextRecallStability(params, difficulty, stability, recalledAt, 3);
    difficulty = clamp(nextDifficulty(params, difficulty, 3), 1, 10);
  }
  return out;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const intervals = firstIntervals(5);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-4 sm:px-8">
        <header className="flex h-16 items-center">
          <Logo />
        </header>
        <main className="flex flex-1 items-center justify-center py-10">{children}</main>
      </div>

      <aside className="relative hidden overflow-hidden bg-brand text-on-brand lg:flex lg:flex-col lg:justify-center lg:px-16">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-on-brand/[0.07]"
        />
        <p className="eyebrow text-on-brand/60!">How it schedules</p>
        <SplitHeading
          as="h2"
          delay={0.15}
          text="Each card comes back just before you would forget it."
          className="font-display mt-4 max-w-[16ch] text-[clamp(34px,3.6vw,52px)] font-semibold leading-[1.02]"
        />
        <p className="mt-5 max-w-[46ch] text-ui text-on-brand/75">
          Answer a card and its memory gets more stable, so the next gap is longer. These
          are the gaps for a card you keep getting right, at the default 90% target.
        </p>

        <IntervalLadder intervals={intervals} />

        <p className="mt-8 max-w-[46ch] text-caption text-on-brand/60">
          Get one wrong and the gap shortens again. The numbers come from the same engine
          that schedules your cards.
        </p>
      </aside>
    </div>
  );
}
