import type { Metadata } from 'next';
import { Reveal, SplitHeading, Stagger, StaggerItem } from '@/components/motion';
import { SiteHero, Term } from '@/components/site/parts';
import { LinkButton } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Android app',
  description:
    'The Recallify Android app is in development. What is already done, what is left, and how to use Recallify on a phone today.',
};

const BUILT = [
  {
    title: 'The same scheduler',
    body: 'The phone will run exactly the scheduling model the web app runs. A card reviewed on your laptop and the same card reviewed on your phone get the same next date, because it is the same code.',
  },
  {
    title: 'The same account',
    body: 'One account, the same decks, the same history. Nothing to export, nothing to move. The day the app is out, you sign in and your cards are there.',
  },
  {
    title: 'Answers that survive a tunnel',
    body: 'Every answer is stored on the device first and sent when there is a connection, and each one is counted once no matter how many times it has to be resent. This is the part offline sync usually gets wrong, and it is already built and tested.',
  },
];

const LEFT = [
  'The screens themselves, designed for one thumb rather than shrunk from the desktop.',
  'A full local copy of every deck, so any of them can be studied with no connection, not only the session last loaded.',
  'The Play Store listing, and the review period that comes with it.',
];

export default function AndroidPage() {
  return (
    <>
      <SiteHero
        eyebrow="Android app"
        title="The app is in development. The engine it needs is already done."
        accentWords={['development.']}
        lead={
          <>
            There is no download link on this page, because there is nothing to download
            yet. Rather than collect an email address for an app that does not exist, here
            is exactly where it stands.
          </>
        }
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <LinkButton href="/register" variant="primary" size="lg">
            Use it in the browser
          </LinkButton>
          <span className="text-ui text-ink-muted">
            Your account and your cards will be the same ones on the phone.
          </span>
        </div>
      </SiteHero>

      <section>
        <div className="mx-auto max-w-310 px-4 py-16 sm:px-8 lg:py-24">
          <SplitHeading
            as="h2"
            text="What is already done."
            className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
          />
          <Stagger
            inView
            gap={0.1}
            className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3"
          >
            {BUILT.map((item) => (
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

      <section className="border-t border-line-strong bg-surface">
        <div className="mx-auto grid max-w-310 gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-24">
          <div>
            <SplitHeading
              as="h2"
              text="What is left."
              className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
            />
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-[46ch] text-body text-ink-muted">
                No date is promised here. When the app is on the Play Store this page will
                say so, and until then it will keep saying this.
              </p>
            </Reveal>
          </div>
          <Stagger as="ul" inView className="border-t border-line-strong lg:mt-2">
            {LEFT.map((line) => (
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

      <section className="border-t border-line-strong">
        <div className="mx-auto max-w-310 px-4 py-16 sm:px-8 lg:py-20">
          <SplitHeading
            as="h2"
            text="On a phone today."
            className="font-display text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.02] text-ink"
          />
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-[68ch] text-body text-ink-muted">
              The web app is built for a phone first: the review screen is one thumb, the
              rating buttons sit at the bottom of the display, and it can be added to your
              home screen from the browser menu. If the connection drops in the middle of
              a session, <Term>keep answering</Term>. The answers are stored on the device
              and sent when it comes back. Pages you have opened once on the device
              open again with no connection, including the review screen with the
              cards it last loaded.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
