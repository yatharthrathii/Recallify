'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Image, { type StaticImageData } from 'next/image';
import { useEffect, useState } from 'react';
import { EASE, Reveal, SplitHeading } from '@/components/motion';
import { cn } from '@/lib/cn';
import phoneShot from '@/assets/site/phone-review.webp';
import reviewShot from '@/assets/site/review.webp';
import statsShot from '@/assets/site/stats.webp';
import todayShot from '@/assets/site/today.webp';

interface Screen {
  id: string;
  title: string;
  body: string;
  image: StaticImageData;
  alt: string;
}

/**
 * Real screens, captured from the app with a real account. Nothing here is a
 * mockup, which is why the numbers in them are ordinary rather than flattering.
 */
const SCREENS: readonly Screen[] = [
  {
    id: 'today',
    title: 'Today',
    body: 'What is due, how long it will take, and which decks it comes from. The next two weeks are drawn so a heavy day never arrives as a surprise.',
    image: todayShot,
    alt: 'The Today screen: ten cards due, about one minute, with a streak, a thirty day recall rate, and a bar chart of the next fourteen days.',
  },
  {
    id: 'review',
    title: 'Review',
    body: 'One card at a time, and one key to see the reasoning: how stable the memory is, the chance you recall it right now, and the date it slips below your target.',
    image: reviewShot,
    alt: 'The review screen showing a card with its answer, the reasoning panel with stability, difficulty and the date recall falls below target, and four rating buttons.',
  },
  {
    id: 'stats',
    title: 'Stats',
    body: 'A year of reviews, coloured by how much you actually recalled each day. Every number is computed from your review log, and none of it resets.',
    image: statsShot,
    alt: 'The stats screen with a recall rate, streak, review count and level, and a heatmap of the last year of reviews.',
  },
];

const DWELL_MS = 6000;

export function ProductShowcase() {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const reduced = useReducedMotion();

  // The screens rotate on their own until the visitor takes over, so the
  // section reads as a demonstration rather than a set of thumbnails.
  useEffect(() => {
    if (held || reduced) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % SCREENS.length),
      DWELL_MS,
    );
    return () => window.clearInterval(id);
  }, [held, reduced]);

  const screen = SCREENS[active] ?? SCREENS[0]!;
  const choose = (i: number) => {
    setActive(i);
    setHeld(true);
  };

  return (
    <section className="border-t border-line-strong bg-surface">
      <div className="mx-auto max-w-310 px-4 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <div>
            <Reveal>
              <p className="eyebrow">Inside the app</p>
            </Reveal>
            <SplitHeading
              as="h2"
              text="The whole model, on the screen."
              accentWords={['whole']}
              className="font-display mt-4 text-[clamp(30px,4.2vw,52px)] font-semibold leading-[1.02] text-ink"
            />
          </div>
          <Reveal delay={0.2}>
            <p className="max-w-[46ch] text-body text-ink-muted">
              These are screenshots of the app, not illustrations. The account is a real
              one with a few weeks of history.
            </p>
          </Reveal>
        </div>

        <div
          className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12"
          onMouseEnter={() => setHeld(true)}
        >
          <div
            role="tablist"
            aria-label="Screens of the app"
            className="scroll-quiet -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t lg:border-line-strong"
          >
            {SCREENS.map((item, i) => {
              const selected = i === active;
              return (
                <button
                  key={item.id}
                  role="tab"
                  id={`shot-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`shot-panel-${item.id}`}
                  type="button"
                  onClick={() => choose(i)}
                  onFocus={() => setHeld(true)}
                  className={cn(
                    'group relative shrink-0 rounded-md border px-4 py-3 text-left transition-colors duration-300',
                    'lg:rounded-none lg:border-x-0 lg:border-t-0 lg:px-0 lg:py-6',
                    selected
                      ? 'border-ink bg-paper lg:border-b-line-strong lg:bg-transparent'
                      : 'border-line bg-transparent hover:border-line-strong lg:border-b-line-strong',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-0 top-0 hidden h-px w-full origin-left bg-accent transition-transform duration-500 ease-[var(--ease-out-expo)] lg:block',
                      selected ? 'scale-x-100' : 'scale-x-0',
                    )}
                  />
                  <span className="flex items-baseline gap-3">
                    <span
                      className={cn(
                        'tabular text-caption transition-colors',
                        selected ? 'text-accent' : 'text-ink-faint',
                      )}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={cn(
                        'font-display text-h3 font-semibold transition-colors',
                        selected ? 'text-ink' : 'text-ink-muted group-hover:text-ink',
                      )}
                    >
                      {item.title}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'mt-2 hidden max-w-[40ch] text-ui text-ink-muted',
                      selected && 'lg:block',
                    )}
                  >
                    {item.body}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Reveal>
              <div className="overflow-hidden rounded-lg border border-line-strong bg-paper shadow-[var(--shadow-md)]">
                <div className="flex h-9 items-center gap-1.5 border-b border-line bg-surface-alt/60 px-3">
                  <span aria-hidden className="size-2.5 rounded-full bg-line-strong" />
                  <span aria-hidden className="size-2.5 rounded-full bg-line-strong" />
                  <span aria-hidden className="size-2.5 rounded-full bg-line-strong" />
                  <span className="tabular ml-3 hidden rounded-sm bg-paper px-2 py-0.5 text-caption text-ink-faint sm:block">
                    recallify / {screen.id}
                  </span>
                </div>
                <div className="relative aspect-[16/10]">
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={screen.id}
                      role="tabpanel"
                      id={`shot-panel-${screen.id}`}
                      aria-labelledby={`shot-tab-${screen.id}`}
                      initial={{ opacity: 0, scale: 1.02 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: EASE }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={screen.image}
                        alt={screen.alt}
                        fill
                        sizes="(min-width: 1280px) 800px, (min-width: 1024px) 66vw, 100vw"
                        placeholder="blur"
                        priority={active === 0}
                        className="object-cover object-top"
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </Reveal>

            {/* The phone sits over the corner of the desktop frame, the way the
                product sits in a pocket next to a laptop. It hangs off the outer
                edge so it never covers the tab list. Below lg there is no
                corner to spare, so it is left out rather than squeezed in. */}
            <motion.div
              aria-hidden
              initial={{ opacity: 0, y: 40, rotate: 3 }}
              whileInView={{ opacity: 1, y: 0, rotate: 3 }}
              viewport={{ once: true, margin: '0px 0px -10% 0px' }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
              className="absolute -bottom-10 -right-4 hidden w-37.5 overflow-hidden rounded-[22px] border-5 border-ink bg-ink shadow-[var(--shadow-lift)] lg:block xl:-right-10 xl:w-42.5"
            >
              <div className="relative aspect-[390/844] overflow-hidden rounded-[17px]">
                <Image
                  src={phoneShot}
                  alt=""
                  fill
                  sizes="170px"
                  className="object-cover object-top"
                />
              </div>
            </motion.div>
          </div>
        </div>

        <p className="mt-6 text-ui text-ink-muted lg:hidden">{screen.body}</p>
      </div>
    </section>
  );
}
