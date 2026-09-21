'use client';

import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** easeOutExpo. Leaves fast, lands softly. Every entrance in the app uses it. */
export const EASE = [0.16, 1, 0.3, 1] as const;

const RISE = 28;

const riseVariants: Variants = {
  hidden: { opacity: 0, y: RISE },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

/**
 * A block that rises into place the first time it is scrolled into view.
 * Once only: content that re-animates every time it re-enters is a distraction.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'header';
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: RISE }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/**
 * A parent whose `StaggerItem` children arrive one after another. `inView`
 * waits for scroll; without it the sequence starts on mount, which is what a
 * page header wants.
 */
export function Stagger({
  children,
  className,
  gap = 0.07,
  delay = 0,
  inView = false,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  inView?: boolean;
  as?: 'div' | 'ul' | 'ol' | 'dl';
}) {
  const Tag = motion[as];
  const variants: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: gap, delayChildren: delay } },
  };
  return (
    <Tag
      className={className}
      variants={variants}
      initial="hidden"
      {...(inView
        ? { whileInView: 'shown', viewport: { once: true, margin: '0px 0px -10% 0px' } }
        : { animate: 'shown' })}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'p' | 'span';
}) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={riseVariants}>
      {children}
    </Tag>
  );
}

/**
 * A headline that comes up from behind its own baseline, a word at a time.
 * Each word sits in a clipped box, so it appears to be pushed up through a
 * slot rather than faded in. Screen readers get the sentence once, whole.
 */
export function SplitHeading({
  text,
  className,
  as = 'h1',
  delay = 0,
  accentWords = [],
}: {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'p';
  delay?: number;
  /** Words (matched without punctuation) set in the accent colour. */
  accentWords?: readonly string[];
}) {
  const Tag = motion[as];
  const words = text.split(' ');
  return (
    <Tag
      className={className}
      aria-label={text}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.055, delayChildren: delay } },
      }}
    >
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden
          // The padding keeps descenders inside the clip; the margin takes it back.
          className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom"
        >
          <motion.span
            className={cn(
              'inline-block will-change-transform',
              accentWords.includes(word.replace(/[^\p{L}\p{N}]/gu, '')) && 'text-accent',
            )}
            variants={{
              hidden: { y: '112%', rotate: 4 },
              shown: { y: 0, rotate: 0, transition: { duration: 0.9, ease: EASE } },
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? '\u00A0' : null}
        </span>
      ))}
    </Tag>
  );
}

/**
 * A number that counts up to its value the first time it is seen, and glides
 * to the new value whenever it changes after that. It writes straight to the
 * DOM node, so sixty frames of counting cost zero React renders.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString('en-US'),
  className,
  duration = 1.1,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const node = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const seen = useInView(node, { once: true });
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = node.current;
    if (!el || !seen) return;
    if (reduced) {
      el.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE,
      onUpdate: (latest) => {
        el.textContent = format(latest);
      },
    });
    from.current = value;
    return () => controls.stop();
    // `format` is left out on purpose: it is an inline arrow at most call
    // sites, and re-running on its identity would restart the count.
  }, [value, seen, reduced, duration]);

  return (
    <span ref={node} className={className}>
      {format(0)}
    </span>
  );
}

/** A thin bar that fills from the left when it is first seen. */
export function FillBar({ ratio, className }: { ratio: number; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-line', className)}>
      <motion.div
        className="h-full origin-left rounded-full bg-accent"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: Math.min(1, Math.max(0, ratio)) }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
      />
    </div>
  );
}
