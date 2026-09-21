'use client';

import { motion } from 'motion/react';
import { EASE } from '@/components/motion';

/**
 * A slow band of facts between the hero and the body. The list is rendered
 * twice and slid by exactly half its width, so the loop has no seam. The copy
 * is for sighted readers skimming; screen readers get it once.
 */
export function FactsMarquee({ facts }: { facts: readonly string[] }) {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {facts.map((fact) => (
        <li key={fact} className="flex items-center whitespace-nowrap">
          <span className="tabular px-6 text-ui uppercase tracking-[0.08em] text-on-brand sm:px-9">
            {fact}
          </span>
          <span aria-hidden className="size-1.5 rotate-45 bg-on-brand/50" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="overflow-hidden bg-brand py-4">
      <div className="animate-marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

interface Band {
  name: string;
  range: string;
  swatch: string;
  /** How full the bar is drawn, as a share of the tile. */
  fill: number;
}

/** The five bands, each bar growing to a length that echoes its range. */
export function MemoryScale({ bands }: { bands: readonly Band[] }) {
  return (
    <motion.ul
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -15% 0px' }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.1 } } }}
      className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5"
    >
      {bands.map((band) => (
        <motion.li
          key={band.name}
          variants={{
            hidden: { opacity: 0, y: 20 },
            shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
          }}
          className="bg-surface px-4 py-5 last:col-span-2 sm:last:col-span-1"
        >
          <span
            aria-hidden
            className="block h-2 w-full overflow-hidden rounded-full bg-surface-alt"
          >
            <motion.span
              className={`block h-full origin-left rounded-full ${band.swatch}`}
              variants={{
                hidden: { scaleX: 0 },
                shown: {
                  scaleX: band.fill,
                  transition: { duration: 1.2, ease: EASE, delay: 0.2 },
                },
              }}
            />
          </span>
          <p className="mt-4 text-body font-medium text-ink">{band.name}</p>
          <p className="tabular text-caption text-ink-muted">{band.range}</p>
        </motion.li>
      ))}
    </motion.ul>
  );
}

/** The name, as large as the page allows, each letter pushed up from below. */
export function Wordmark() {
  const letters = 'Recallify'.split('');
  return (
    <motion.p
      aria-hidden
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -5% 0px' }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.05 } } }}
      className="font-display select-none overflow-hidden whitespace-nowrap text-center text-[clamp(64px,21vw,320px)] pb-[0.08em] font-semibold leading-[0.82] text-ink"
    >
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          className="inline-block will-change-transform"
          variants={{
            hidden: { y: '100%' },
            shown: { y: 0, transition: { duration: 1, ease: EASE } },
          }}
        >
          {letter}
        </motion.span>
      ))}
    </motion.p>
  );
}
