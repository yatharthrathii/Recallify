import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Hero } from '@/components/landing/hero';
import { FactsMarquee, MemoryScale, Wordmark } from '@/components/landing/pieces';
import { SiteHeader } from '@/components/landing/site-header';
import { TryCard } from '@/components/landing/try-card';
import { Reveal, SplitHeading, Stagger, StaggerItem } from '@/components/motion';
import { LinkButton } from '@/components/ui/button';

const REPO = 'https://github.com/yatharthrathii/Recallify';

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
    body: 'After 400 reviews, the 21 parameters can be fitted to your own history and compared with the defaults side by side. It buys accuracy. If you forget faster than average, the honest result is more reviews, and it says so.',
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
  'FSRS scheduler',
  '21 parameters',
  '19,000 cases checked against the reference',
  'Append only review log',
  'Keyboard first',
  'Open source',
  'No ads',
];

const NOT = [
  'It does not send guilt notifications about a streak.',
  'AI drafts are drafts. A language model wrote them and you approve each one before it is saved.',
  'It does not replace Anki’s add-ons or shared deck library. Importing Anki decks is planned, not built.',
  'It works in the browser today. The Android app is planned, not built.',
];

const UNDER_THE_HOOD = [
  [
    'Scheduler',
    'FSRS, written from the published algorithm and checked against the reference implementation across 19,000 generated cases',
  ],
  [
    'Optimizer',
    'Gradient descent on log loss over your review log, with a backtest beside every fit',
  ],
  [
    'Review log',
    'Append only. Card state is a cache that can be rebuilt by replaying it',
  ],
  [
    'Sync',
    'Every review carries an id made on your device, so a retry can never count twice',
  ],
  ['Stack', 'TypeScript throughout. NestJS, PostgreSQL, Prisma, Next.js'],
];

export default async function LandingPage() {
  const signedIn = (await cookies()).has('rc_session');
  const cta = signedIn ? '/today' : '/register';
  const ctaLabel = signedIn ? 'Open the app' : 'Create a free account';

  return (
    <div className="min-h-dvh">
      <SiteHeader signedIn={signedIn} repo={REPO} />

      <main>
        <Hero signedIn={signedIn} />

        <FactsMarquee facts={FACTS} />

        <section>
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-32">
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
                  Every spaced repetition app runs a memory model. Most show you a due
                  count and nothing else. Here the model is the interface.
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
                  <span className="font-display text-[44px] font-medium leading-none text-line-strong transition-colors duration-500 group-hover:text-accent">
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
          <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-8 lg:py-28">
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
          <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-8 lg:py-28">
            <SplitHeading
              as="h2"
              text="Colour means one thing here."
              accentWords={['one']}
              className="font-display text-[clamp(30px,4.2vw,52px)] font-semibold leading-[1.02] text-ink"
            />
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-[64ch] text-body text-ink-muted">
                Five hues, and each is a range of predicted recall. They appear on the
                curve, the review card and the activity grid, and nowhere else. If
                something is amber, it is fading.
              </p>
            </Reveal>
            <MemoryScale bands={SCALE} />
          </div>
        </section>

        <section className="border-t border-line-strong">
          <div className="mx-auto grid max-w-[1240px] gap-16 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-28">
            <div>
              <SplitHeading
                as="h2"
                text="What it does not do."
                className="font-display text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.05] text-ink"
              />
              <Reveal delay={0.1}>
                <p className="mt-4 max-w-[52ch] text-ui text-ink-muted">
                  The first version of this project described features it did not have.
                  This one lists its limits on the front page.
                </p>
              </Reveal>
              <Stagger as="ul" inView className="mt-8 border-t border-line">
                {NOT.map((line) => (
                  <StaggerItem
                    as="li"
                    key={line}
                    className="border-b border-line py-4 text-ui text-ink"
                  >
                    {line}
                  </StaggerItem>
                ))}
              </Stagger>
            </div>

            <div>
              <SplitHeading
                as="h2"
                text="Under the hood."
                className="font-display text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.05] text-ink"
              />
              <Reveal delay={0.1}>
                <p className="mt-4 max-w-[52ch] text-ui text-ink-muted">
                  For the engineers. All of it is in the repository, with the tests.
                </p>
              </Reveal>
              <Stagger as="dl" inView className="mt-8 border-t border-line">
                {UNDER_THE_HOOD.map(([term, detail]) => (
                  <StaggerItem
                    key={term}
                    className="grid gap-x-6 gap-y-0.5 border-b border-line py-4 sm:grid-cols-[110px_minmax(0,1fr)]"
                  >
                    <dt className="tabular text-caption uppercase tracking-[0.06em] text-ink-faint sm:pt-0.5">
                      {term}
                    </dt>
                    <dd className="text-ui text-ink">{detail}</dd>
                  </StaggerItem>
                ))}
              </Stagger>
              <Reveal>
                <a
                  href={REPO}
                  className="group mt-6 inline-flex items-center gap-1.5 text-ui font-medium text-ink"
                >
                  <span className="link-sweep">Read the source on GitHub</span>
                  <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="border-t border-line-strong bg-highlight">
          <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-8 px-4 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-24">
            <div>
              <SplitHeading
                as="h2"
                text="Make a deck. Watch the first curve."
                className="font-display max-w-[14ch] text-[clamp(34px,5.4vw,72px)] font-semibold leading-[0.98] text-ink"
              />
              <Reveal delay={0.2}>
                <p className="mt-4 text-body text-ink-muted">
                  It starts with the first card you answer.
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.3}>
              <LinkButton href={cta} variant="primary" size="lg" className="group">
                {ctaLabel}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </LinkButton>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="overflow-hidden border-t border-line-strong">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 pb-6 pt-10 text-caption text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="max-w-[60ch]">
            Built by Yatharth Rathi. FSRS is the work of Jarrett Ye and the Open Spaced
            Repetition community.
          </p>
          <nav aria-label="Footer" className="flex gap-6 text-ink">
            <a href={REPO} className="link-sweep">
              GitHub
            </a>
            <Link href="/login" className="link-sweep">
              Sign in
            </Link>
            <Link href="/register" className="link-sweep">
              Create account
            </Link>
          </nav>
        </div>
        <Wordmark />
      </footer>
    </div>
  );
}
