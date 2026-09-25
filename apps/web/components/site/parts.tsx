import type { ReactNode } from 'react';
import { Reveal, SplitHeading } from '@/components/motion';
import { cn } from '@/lib/cn';

/** The top of any page that is not the landing page. */
export function SiteHero({
  eyebrow,
  title,
  lead,
  accentWords,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  accentWords?: readonly string[];
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-line-strong">
      <div className="mx-auto max-w-310 px-4 py-16 sm:px-8 lg:py-24">
        <Reveal>
          <p className="eyebrow">{eyebrow}</p>
        </Reveal>
        <SplitHeading
          text={title}
          {...(accentWords ? { accentWords } : {})}
          className="font-display mt-4 max-w-[18ch] text-[clamp(36px,6vw,76px)] font-semibold leading-[0.98] text-ink"
        />
        <Reveal delay={0.15}>
          <div className="mt-6 max-w-[62ch] text-body text-ink-muted">{lead}</div>
        </Reveal>
        {children ? <Reveal delay={0.25}>{children}</Reveal> : null}
      </div>
    </header>
  );
}

/** A band of text on a site page. The heading is its own anchor. */
export function SiteSection({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Reveal
      as="section"
      className={cn('border-b border-line px-4 py-12 sm:px-8 lg:py-16', className)}
    >
      <div className="mx-auto grid max-w-310 gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        {title ? (
          <h2
            {...(id ? { id } : {})}
            className="font-display text-h2 font-semibold text-ink lg:sticky lg:top-24 lg:self-start"
          >
            {title}
          </h2>
        ) : null}
        <div
          className={cn(
            'flex flex-col gap-4 text-body text-ink-muted',
            title ? '' : 'lg:col-span-2',
          )}
        >
          {children}
        </div>
      </div>
    </Reveal>
  );
}

/** A list of short lines, hairline separated. Used all over the site pages. */
export function SiteList({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="flex flex-col border-t border-line">
      {items.map((item, i) => (
        <li key={i} className="border-b border-line py-3.5 text-ui text-ink">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Emphasis inside body copy, without shouting. */
export function Term({ children }: { children: ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}
