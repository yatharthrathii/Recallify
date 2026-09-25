'use client';

import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';
import { EASE, SplitHeading } from '@/components/motion';
import { LinkButton } from '@/components/ui/button';
import { DemoCurve } from './demo-curve';

/**
 * The headline runs the full width and the working demo sits under it. The
 * disc behind the type is flat colour with a hard edge, and it drifts as the
 * page scrolls: a slow object behind fast text is what gives the page depth.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ['start start', 'end start'],
  });
  const discY = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const discScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);

  return (
    <section ref={section} className="relative overflow-hidden">
      <motion.div
        aria-hidden
        style={{ y: discY, scale: discScale }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: EASE }}
        className="pointer-events-none absolute -right-[18vw] -top-[10vw] size-[62vw] max-h-190 max-w-190 rounded-full bg-highlight sm:-right-[6vw] sm:-top-[8vw] sm:size-[46vw]"
      />

      <div className="relative mx-auto max-w-310 px-4 pb-16 pt-10 sm:px-8 sm:pt-16 lg:pb-24">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          className="eyebrow text-ink-muted!"
        >
          Spaced repetition, with the scheduler visible
        </motion.p>

        <SplitHeading
          text="A flashcard scheduler that shows its work."
          accentWords={['work']}
          delay={0.2}
          className="font-display mt-5 max-w-[15ch] text-[clamp(44px,8.6vw,124px)] font-semibold leading-[0.94] text-ink"
        />

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.75 }}
          >
            <p className="max-w-[46ch] text-body text-ink-muted">
              Recallify schedules every card with FSRS, the open source spaced repetition
              model, and shows you what is normally hidden: the forgetting curve of every
              card, why a card is due today, and what your own history says about the
              defaults.
            </p>
            {/* One button. Signing in lives in the header, where someone who
                already has an account will look for it. */}
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <LinkButton
                href={signedIn ? '/today' : '/register'}
                variant="primary"
                size="lg"
                className="group"
              >
                {signedIn ? 'Open the app' : 'Create a free account'}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </LinkButton>
              <Link
                href="/how-it-works"
                className="link-sweep whitespace-nowrap text-ui font-medium text-ink"
              >
                How it works
              </Link>
            </div>
            <p className="tabular mt-5 text-caption text-ink-faint">
              Free. No ads. No card required.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, ease: EASE, delay: 0.9 }}
          >
            <DemoCurve />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
