import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { Reveal, SplitHeading, Stagger, StaggerItem } from '@/components/motion';
import { SiteHero, Term } from '@/components/site/parts';
import { LinkButton } from '@/components/ui/button';
import { GITHUB, MAKER } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description:
    'What Recallify is trying to be, the principles it is held to, and who makes it.',
};

const PRINCIPLES = [
  {
    title: 'Never claim what it cannot do',
    body: 'The front page lists the limits next to the features. If something is planned, it says planned. If the app cannot do a thing yet, no page here pretends otherwise.',
  },
  {
    title: 'Show the reasoning',
    body: 'The scheduler decides when you see a card again. You should be able to ask why, get a real answer, and disagree with it by moving your own target.',
  },
  {
    title: 'Your data is yours',
    body: 'No ads, nothing sold, no tracking. Deleting the account deletes the decks, the cards and the review history, and there is one button for it.',
  },
  {
    title: 'The core stays free',
    body: 'The curve, the reasoning, the retention slider and the fitted model are the reason to use this rather than something else. They are not going behind a paywall.',
  },
];

const GUARANTEES = [
  [
    'Scheduling',
    'FSRS, the open source spaced repetition model, implemented from the published specification and verified against the reference implementation.',
  ],
  [
    'Your history',
    'Every answer is kept, and nothing overwrites it. Editing a card never resets its schedule, and a lost connection never loses an answer.',
  ],
  [
    'Sync',
    'Each answer carries an id made on your device, so a retry after a dropped connection can never be counted twice.',
  ],
  [
    'AI drafts',
    'Drafted from your topic or notes, shown to you first, and saved only when you approve them. Your account details never go to the model.',
  ],
] as const;

export default function AboutPage() {
  return (
    <>
      <SiteHero
        eyebrow="About"
        title="A study tool that refuses to overstate itself."
        accentWords={['refuses']}
        lead={
          <>
            Recallify is a spaced repetition app for people with a lot to remember and
            a long time to remember it. It is free, it carries no advertising, and it
            tells you what its scheduler is doing rather than asking you to trust it.
          </>
        }
      />

      <section>
        <div className="mx-auto grid max-w-310 gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-24">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SplitHeading
              as="h2"
              text="Why it exists."
              className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
            />
          </div>
          <Reveal delay={0.1}>
            <div className="flex max-w-[68ch] flex-col gap-5 text-body text-ink-muted">
              <p>
                Most flashcard apps hide their scheduler. You are given a number of cards
                due today and asked to trust it. When the number is large the usual
                reaction is to stop, and nothing on the screen explains what that costs or
                what would happen if you reviewed half.
              </p>
              <p>
                The model that produces that number is not complicated to look at. It
                holds two values per card, it can draw the curve it believes you are on,
                and it can say the date your memory of a card falls under the level you
                asked for. Recallify puts that on the screen.{' '}
                <Term>The scheduler is the product</Term>, and the app around it exists to
                show it working.
              </p>
              <p>
                That also sets the tone for everything else here. A page that shows you
                the model cannot then hide the limits, so the limits are on the front
                page, and the Android app has a page that says it is not finished.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line-strong bg-surface">
        <div className="mx-auto max-w-310 px-4 py-16 sm:px-8 lg:py-24">
          <SplitHeading
            as="h2"
            text="What it is held to."
            className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
          />
          <Stagger
            inView
            gap={0.1}
            className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2"
          >
            {PRINCIPLES.map((item) => (
              <StaggerItem key={item.title} className="bg-surface p-6 sm:p-8">
                <h3 className="font-display text-h3 font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-3 text-ui text-ink-muted">{item.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="border-t border-line-strong">
        <div className="mx-auto grid max-w-310 gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-24">
          <div>
            <SplitHeading
              as="h2"
              text="What you can rely on."
              className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
            />
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-[46ch] text-body text-ink-muted">
                The promises the app is built around. Each one is a design decision, not
                a setting, so none of them can quietly change.
              </p>
            </Reveal>
          </div>
          <Stagger as="dl" inView className="border-t border-line lg:mt-2">
            {GUARANTEES.map(([term, detail]) => (
              <StaggerItem
                key={term}
                className="grid gap-x-8 gap-y-1 border-b border-line py-4 sm:grid-cols-[140px_minmax(0,1fr)]"
              >
                <dt className="tabular text-caption uppercase tracking-[0.06em] text-ink-faint sm:pt-1">
                  {term}
                </dt>
                <dd className="text-ui text-ink">{detail}</dd>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="border-t border-line-strong bg-highlight">
        <div className="mx-auto grid max-w-310 gap-8 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:py-20">
          <div>
            <SplitHeading
              as="h2"
              text="Who makes it."
              className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
            />
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-[56ch] text-body text-ink-muted">
                Recallify is designed and built by {MAKER}, a full stack engineer in
                India. Problems, ideas and questions reach him through GitHub, and he
                answers for every page of this site personally. Inside the app, an AI
                draft that comes out wrong can be reported from the screen it appeared on.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.25} className="lg:justify-self-end">
            <LinkButton href={GITHUB} variant="primary" size="lg" className="group">
              {MAKER} on GitHub
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </LinkButton>
          </Reveal>
        </div>
      </section>
    </>
  );
}
