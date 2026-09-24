import type { Metadata } from 'next';
import { GITHUB, MAKER } from '@/lib/site';
import { SiteHero, SiteList, SiteSection, Term } from '@/components/site/parts';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What Recallify stores, where it is stored, what leaves the service, and how to delete all of it.',
};

const UPDATED = '25 September 2026';

export default function PrivacyPage() {
  return (
    <>
      <SiteHero
        eyebrow={`Privacy policy. Last updated ${UPDATED}`}
        title="What is stored, where it goes, and how to delete it."
        lead={
          <>
            Recallify is free and carries no advertising, so there is no business here
            that depends on collecting more than the app needs. This page says exactly
            what that is.
          </>
        }
      />

      <SiteSection title="Who runs this">
        <p>
          Recallify is operated by {MAKER}, an individual developer in India. Questions
          about this policy can be sent to him through{' '}
          <a href={GITHUB} className="link-sweep text-ink">
            GitHub
          </a>
          .
        </p>
      </SiteSection>

      <SiteSection title="What is stored">
        <p>Only what the app needs in order to work:</p>
        <SiteList
          items={[
            <>
              <Term>Your account.</Term> Email address, a display name if you give one,
              and your password stored as an Argon2 hash. The password itself is never
              stored and cannot be read back.
            </>,
            <>
              <Term>Your study material.</Term> The decks and cards you create or accept,
              including anything you type into them.
            </>,
            <>
              <Term>Your review history.</Term> For every answer: which card, which of the
              four ratings, when, how long you looked at it, and the scheduling values
              before and after. This log is what the schedule is computed from.
            </>,
            <>
              <Term>Your settings.</Term> Retention target, daily limits, and the fitted
              scheduling parameters if you choose to adopt them.
            </>,
            <>
              <Term>Sign in sessions.</Term> A hash of each refresh token, its expiry, and
              the browser identification string your browser sends, so a session can be
              recognised and revoked.
            </>,
            <>
              <Term>AI usage counts.</Term> How many cards you drafted and when, to
              enforce the daily allowance. If you report a draft as wrong or offensive,
              that card's text and your reason are stored so the problem can be looked at.
            </>,
          ]}
        />
        <p>
          There is no advertising identifier, no third party analytics, no tracking pixel,
          and no profile built about you. Nothing is sold, and nothing is shared for
          marketing.
        </p>
      </SiteSection>

      <SiteSection title="Cookies and local storage">
        <p>
          Signing in sets cookies that hold your session. They are marked so that
          JavaScript cannot read them, and they exist for authentication only, not to
          follow you between sites. Your theme choice and any answers waiting to be sent
          are kept in your browser's own storage on your device.
        </p>
      </SiteSection>

      <SiteSection title="What leaves the service">
        <p>Two providers see data, and only for the job they do:</p>
        <SiteList
          items={[
            <>
              <Term>Hosting and database.</Term> The site and the API run on Vercel; the
              database runs on Neon. Both hold the data described above in order to serve
              it back to you.
            </>,
            <>
              <Term>AI drafting.</Term> When you ask for card drafts, the topic or notes
              you typed are sent to Groq, which runs the language model that writes them.
              Your email address and account identifier are not sent. If you never use
              that feature, nothing is ever sent there.
            </>,
          ]}
        />
        <p>
          Beyond that, data is disclosed only if the law requires it. Server logs record
          the method, path, status and timing of requests; authorization headers and
          cookies are stripped before anything is written.
        </p>
      </SiteSection>

      <SiteSection title="Deleting your data">
        <p>
          Settings has a delete button. It asks for your password, and then removes your
          account, your decks, your cards, your whole review history and your sessions. It
          cannot be undone and there is no backup you can be restored from. A single card
          or deck can be deleted the same way, from the app, at any time.
        </p>
        <p>
          Accounts that are still in use are kept until you delete them, because a spaced
          repetition schedule that forgets your history is worthless.
        </p>
      </SiteSection>

      <SiteSection title="Security">
        <p>
          Traffic runs over HTTPS. Passwords are hashed with Argon2. Access tokens are
          short lived and refresh tokens rotate on every use, so a stolen one stops
          working as soon as the real session continues, and reusing an old one revokes
          the whole family of sessions. No security measure is absolute, and this is a
          free service run by one person, which is worth knowing when you decide what to
          put in a card.
        </p>
      </SiteSection>

      <SiteSection title="Children">
        <p>
          Recallify is not directed at children under 13, and accounts should not be
          created for them.
        </p>
      </SiteSection>

      <SiteSection title="Changes">
        <p>
          If this policy changes, the date at the top changes with it. A change that
          affects what is collected or where it goes will also be announced in the app.
        </p>
      </SiteSection>
    </>
  );
}
