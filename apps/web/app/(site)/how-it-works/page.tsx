import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Reveal, SplitHeading, Stagger, StaggerItem } from '@/components/motion';
import { SiteHero, Term } from '@/components/site/parts';
import { LinkButton } from '@/components/ui/button';
import { IntervalPreview } from '@/components/site/interval-preview';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How Recallify decides when a card comes back: stability, difficulty, your retention target, and a schedule fitted to your own answers.',
};

const STEPS = [
  {
    title: 'You answer a card',
    body: 'Four answers, from Again to Easy. That single choice is the only thing the scheduler asks of you, and the time under each button is what it will do about it.',
  },
  {
    title: 'The memory gets a number',
    body: 'Two of them. Stability is how many days it takes for your chance of recalling the card to fall to 90%. Difficulty is how hard this particular card is for you. Every answer updates both.',
  },
  {
    title: 'The next date follows from your target',
    body: 'You choose how likely you want to be to recall a card when it returns. The gap is then the point where the curve falls to exactly that. A higher target means more reviews, and the settings page prices it before you save it.',
  },
  {
    title: 'The model learns from your log',
    body: 'Every answer is kept, and nothing overwrites it. Once you have enough history the scheduler can be fitted to it and compared with the published defaults, measurement beside measurement, before you adopt anything.',
  },
];

const FAQ = [
  {
    q: 'Is this a new algorithm?',
    a: 'No, and that is the point. Recallify runs FSRS, the open source scheduler that the best known spaced repetition apps have adopted, written from the published specification and checked against the reference implementation. What is different is that Recallify shows you what it computed instead of only the due count.',
  },
  {
    q: 'What happens if I miss a week?',
    a: 'Nothing is lost and nothing is punished. The cards that came due while you were away are waiting, and your daily limit keeps that backlog from turning into a wall. A card you answer late is simply scheduled from what you actually remembered.',
  },
  {
    q: 'Do I have to use the AI drafts?',
    a: 'No. Cards can be typed in, and most people will. Drafting from a topic or your own notes is there for the first fifty cards of a new subject, and every draft is reviewed by you before it is saved.',
  },
  {
    q: 'What if my connection drops mid session?',
    a: 'Keep going. Answers are held on your device and sent when the connection returns, and each one carries an id made locally so a retry cannot count it twice.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <SiteHero
        eyebrow="How it works"
        title="Review a card just before you would have forgotten it."
        accentWords={['before']}
        lead={
          <>
            Reviewing something you still know well is wasted effort, and reviewing it
            after you have forgotten it is starting again. There is a moment in between,
            and a scheduler exists to find it for every card you own.
          </>
        }
      />

      <section>
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-8 lg:py-24">
          <Stagger as="ol" inView gap={0.12} className="border-t border-line-strong">
            {STEPS.map((step, i) => (
              <StaggerItem
                as="li"
                key={step.title}
                className="grid gap-x-8 gap-y-2 border-b border-line-strong py-8 sm:grid-cols-[72px_minmax(0,1fr)]"
              >
                <span className="font-display text-[44px] font-medium leading-none text-line-strong">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 className="font-display text-h2 font-semibold text-ink">
                    {step.title}
                  </h2>
                  <p className="mt-2 max-w-[68ch] text-body text-ink-muted">
                    {step.body}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="border-t border-line-strong bg-surface">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-24">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SplitHeading
              as="h2"
              text="The gaps grow because the memory does."
              className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
            />
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-[46ch] text-body text-ink-muted">
                These are the real gaps for a card you keep getting right, at the default{' '}
                <Term>90%</Term> target. They are computed here by the same engine that
                will schedule your cards. Get one wrong and the gap shortens again.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <IntervalPreview />
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line-strong">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-8 lg:py-24">
          <SplitHeading
            as="h2"
            text="Questions people actually ask."
            className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
          />
          <Stagger as="dl" inView gap={0.09} className="mt-10 border-t border-line">
            {FAQ.map((item) => (
              <StaggerItem
                key={item.q}
                className="grid gap-x-12 gap-y-2 border-b border-line py-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
              >
                <dt className="text-h3 font-semibold text-ink">{item.q}</dt>
                <dd className="max-w-[68ch] text-body text-ink-muted">{item.a}</dd>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="border-t border-line-strong bg-highlight">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-6 px-4 py-16 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-20">
          <SplitHeading
            as="h2"
            text="The first curve appears after your first review."
            className="font-display max-w-[20ch] text-[clamp(28px,3.6vw,48px)] font-semibold leading-[1.02] text-ink"
          />
          <Reveal delay={0.2}>
            <LinkButton href="/register" variant="primary" size="lg" className="group">
              Create a free account
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </LinkButton>
          </Reveal>
        </div>
      </section>
    </>
  );
}
