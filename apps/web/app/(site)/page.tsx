import { ArrowRight } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Hero } from '@/components/landing/hero';
import { FactsMarquee, MemoryScale } from '@/components/landing/pieces';
import { ProductShowcase } from '@/components/landing/product-showcase';
import { TryCard } from '@/components/landing/try-card';
import { Reveal, SplitHeading, Stagger, StaggerItem } from '@/components/motion';
import { LinkButton } from '@/components/ui/button';

const VISIBLE = [
  {
    title: 'The curve of every card',
    body: 'Each card has its own forgetting curve, drawn from your answers. You can see it decay, see each review lift it back, and see the next decay run slower than the last.',
  },
  {
    title: 'Why this card, today',
    body: 'During a review, one key shows the reasoning: how stable the memory is, how likely you are to recall it right now, and the date it would slip below your target.',
  },
  {
    title: 'What a retention target costs',
    body: 'Asking to remember 95% instead of 90% is not free. The settings slider shows the daily reviews each target implies, before you save it.',
  },
  {
    title: 'A model fitted to you',
    body: 'After 400 reviews, the scheduler can be fitted to your own history and compared with the defaults side by side. It buys accuracy. If you forget faster than average, the honest result is more reviews, and it says so.',
  },
];

const SCALE = [
  { name: 'Strong', range: '90% and up', swatch: 'bg-mem-strong', fill: 1 },
  { name: 'Good', range: '75 to 90%', swatch: 'bg-mem-good', fill: 0.82 },
  { name: 'Fading', range: '50 to 75%', swatch: 'bg-mem-fading', fill: 0.62 },
  { name: 'Weak', range: '25 to 50%', swatch: 'bg-mem-weak', fill: 0.38 },
  { name: 'Lost', range: 'under 25%', swatch: 'bg-mem-lost', fill: 0.16 },
];

const FACTS = [
  'Free to use',
  'No ads',
  'No card required',
  'Your data stays yours',
  'Delete your account in one step',
  'Reviews work offline',
];

const FOR = [
  {
    who: 'Exams with a long syllabus',
    body: 'Medicine, law, civil services, the ones where forgetting last month is the real problem. Recallify keeps every card on its own schedule instead of one deadline for all of them.',
  },
  {
    who: 'Languages',
    body: 'Vocabulary is the textbook case for spaced repetition. Add words as you meet them and each comes back at its own pace.',
  },
  {
    who: 'Anything you want in a year',
    body: 'Concepts from a course, a codebase, a job you are preparing for. The schedule stretches as the memory holds.',
  },
];

const LIMITS = [
  'No streak guilt. Recallify does not send notifications to make you feel bad about a missed day.',
  'AI drafts are drafts. A language model writes them, and you approve each card before it is saved.',
  'Importing decks from other apps is planned, not built. Today you add cards by hand or generate drafts.',
  'It runs in the browser. The Android app is in development, and nothing on this page depends on it.',
];

export default async function LandingPage() {
  const signedIn = (await cookies()).has('rc_session');

  return (
    <>
      <Hero signedIn={signedIn} />

      <FactsMarquee facts={FACTS} />

      <ProductShowcase />

      <section>
        <div className="mx-auto grid max-w-310 gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-32">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <p className="eyebrow">What you get to see</p>
            </Reveal>
            <SplitHeading
              as="h2"
              text="Four things other apps compute and then keep to themselves."
              accentWords={['keep']}
              className="font-display mt-4 text-[clamp(30px,4.2vw,52px)] font-semibold leading-[1.02] text-ink"
            />
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-[44ch] text-body text-ink-muted">
                Every spaced repetition app runs a memory model. Most show you a due count
                and nothing else. Here the model is the interface.
              </p>
            </Reveal>
          </div>

          <Stagger as="ol" inView gap={0.12} className="border-t border-line-strong">
            {VISIBLE.map((item, i) => (
              <StaggerItem
                as="li"
                key={item.title}
                className="group grid gap-x-8 gap-y-2 border-b border-line-strong py-8 sm:grid-cols-[72px_minmax(0,1fr)]"
              >
                <span className="font-display text-[44px] font-medium leading-none text-ink-faint transition-colors duration-500 group-hover:text-accent">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-2">
                  <h3 className="font-display text-h2 font-semibold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-[60ch] text-body text-ink-muted">
                    {item.body}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* The one full-bleed block of brand colour on the page. */}
      <section className="bg-brand text-on-brand">
        <div className="mx-auto max-w-310 px-4 py-20 sm:px-8 lg:py-28">
          <div className="mb-12 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
            <SplitHeading
              as="h2"
              text="Do not take our word for it. Answer a card."
              className="font-display text-[clamp(30px,4.6vw,60px)] font-semibold leading-[1.02]"
            />
            <Reveal delay={0.2}>
              <p className="max-w-[48ch] text-body text-on-brand/75">
                This is the scheduler itself, running in your browser. Each answer skips
                the clock forward to the day the card would return.
              </p>
            </Reveal>
          </div>
          <Reveal>
            <TryCard />
          </Reveal>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-310 px-4 py-20 sm:px-8 lg:py-28">
          <SplitHeading
            as="h2"
            text="Who it is for."
            className="font-display text-[clamp(30px,4.2vw,52px)] font-semibold leading-[1.02] text-ink"
          />
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-[60ch] text-body text-ink-muted">
              Anything you need to hold for months rather than days. The longer the
              syllabus, the more the schedule is worth.
            </p>
          </Reveal>
          <Stagger
            inView
            gap={0.1}
            className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3"
          >
            {FOR.map((item) => (
              <StaggerItem
                key={item.who}
                className="bg-surface p-6 transition-colors duration-300 hover:bg-paper sm:p-8"
              >
                <h3 className="font-display text-h3 font-semibold text-ink">
                  {item.who}
                </h3>
                <p className="mt-3 text-ui text-ink-muted">{item.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="border-t border-line-strong">
        <div className="mx-auto max-w-310 px-4 py-20 sm:px-8 lg:py-28">
          <SplitHeading
            as="h2"
            text="Colour means one thing here."
            accentWords={['one']}
            className="font-display text-[clamp(30px,4.2vw,52px)] font-semibold leading-[1.02] text-ink"
          />
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-[64ch] text-body text-ink-muted">
              Five hues, and each is a range of predicted recall. They appear on the
              curve, the review card and the activity grid, and nowhere else. If something
              is amber, it is fading.
            </p>
          </Reveal>
          <MemoryScale bands={SCALE} />
        </div>
      </section>

      <section className="border-t border-line-strong bg-surface">
        <div className="mx-auto grid max-w-310 gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-28">
          <div>
            <Reveal>
              <p className="eyebrow">Straight answers</p>
            </Reveal>
            <SplitHeading
              as="h2"
              text="What Recallify does not do."
              className="font-display mt-4 text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
            />
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-[46ch] text-body text-ink-muted">
                Most products keep the limits for the small print. These belong on the
                front page, so you can decide before you sign up rather than after.
              </p>
            </Reveal>
          </div>
          <Stagger as="ul" inView className="border-t border-line-strong lg:mt-2">
            {LIMITS.map((line) => (
              <StaggerItem
                as="li"
                key={line}
                className="border-b border-line-strong py-5 text-body text-ink"
              >
                {line}
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="border-t border-line-strong bg-highlight">
        <div className="mx-auto flex max-w-310 flex-col items-start gap-8 px-4 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-24">
          <div>
            <SplitHeading
              as="h2"
              text={
                signedIn
                  ? 'Your cards are waiting.'
                  : 'Make a deck. Watch the first curve.'
              }
              className="font-display max-w-[14ch] text-[clamp(34px,5.4vw,72px)] font-semibold leading-[0.98] text-ink"
            />
            <Reveal delay={0.2}>
              <p className="mt-4 text-body text-ink-muted">
                {signedIn
                  ? 'Pick up where you left off.'
                  : 'It starts with the first card you answer. Free, and it takes a minute.'}
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.3}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <LinkButton
                href={signedIn ? '/today' : '/register'}
                variant="primary"
                size="lg"
                className="group"
              >
                {signedIn ? 'Open the app' : 'Create a free account'}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </LinkButton>
              {!signedIn ? (
                <Link
                  href="/how-it-works"
                  className="link-sweep self-start text-ui font-medium text-ink sm:self-auto"
                >
                  Read how the scheduling works
                </Link>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
