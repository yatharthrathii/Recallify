import type { Metadata } from 'next';
import Link from 'next/link';
import { GITHUB, MAKER } from '@/lib/site';
import { SiteHero, SiteList, SiteSection, Term } from '@/components/site/parts';

export const metadata: Metadata = {
  title: 'Terms of use',
  description:
    'The agreement for using Recallify: what you can expect from the service, and what it expects from you.',
};

const UPDATED = '25 September 2026';

export default function TermsPage() {
  return (
    <>
      <SiteHero
        eyebrow={`Terms of use. Last updated ${UPDATED}`}
        title="The short agreement for using Recallify."
        lead={
          <>
            Written to be read rather than skipped. Creating an account means you accept
            it. If you do not, the app is not for you, and nothing here asks for your
            money.
          </>
        }
      />

      <SiteSection title="What the service is">
        <p>
          Recallify is a flashcard application with a spaced repetition scheduler,
          provided free of charge by Yatharth Rathi, an individual developer in India. It
          is offered as it stands. It is not a medical, legal, financial or educational
          certification service, and nothing it schedules is advice.
        </p>
      </SiteSection>

      <SiteSection title="Your account">
        <SiteList
          items={[
            'You need a working email address and a password of at least ten characters. One person, one account.',
            'Keep the password to yourself. Anything done through your account is treated as done by you.',
            'You must be 13 or older to create an account.',
            'You can delete the account at any time from settings. That removes your decks, cards and review history, and it cannot be undone.',
          ]}
        />
      </SiteSection>

      <SiteSection title="Your content">
        <p>
          The cards you write stay yours. You keep every right you had in them, and
          creating them here grants nothing to anyone else. What is needed is the
          permission to store, process and show them back to you, which is the service
          working as intended.
        </p>
        <p>
          You are responsible for what you put in a card, including anything you copy from
          a textbook or a course. Do not upload material you have no right to use.
        </p>
      </SiteSection>

      <SiteSection title="Fair use of the service">
        <p>You agree not to:</p>
        <SiteList
          items={[
            'Break the law with it, or store material that is illegal where you are.',
            'Attack the service, work around its rate limits, or try to reach another account.',
            'Automate it in a way that costs more than a person studying would, including scripting the drafting feature.',
            'Resell access to it.',
          ]}
        />
        <p>
          The drafting feature has a daily allowance for each account, because the model
          behind it costs real money to run and the free tier it uses is shared by
          everyone.
        </p>
      </SiteSection>

      <SiteSection title="AI generated cards">
        <p>
          Drafts are written by a language model. They are <Term>drafts</Term>, they are
          sometimes wrong, and you approve every one before it is saved. Nothing is added
          to your deck without you. Do not rely on a generated card as a source, and
          report one that is wrong or offensive from the screen it appeared on.
        </p>
      </SiteSection>

      <SiteSection title="Availability">
        <p>
          This is a free service and it can be slow, interrupted, or taken down for
          maintenance without notice. Features can change or be withdrawn. No uptime is
          promised, and it would be dishonest to promise one. If the service were ever to
          shut down, a notice would go out in the app first so that you could take your
          cards elsewhere.
        </p>
      </SiteSection>

      <SiteSection title="No warranty, and the limit of liability">
        <p>
          Recallify is provided as it is, without warranties of any kind, to the extent
          the law allows. It is not guaranteed to be uninterrupted, error free, or to
          produce any particular result in an exam.
        </p>
        <p>
          To the extent the law allows, the operator is not liable for indirect or
          consequential loss, for lost study time, or for data loss. Keep your own copy of
          anything you cannot afford to lose. Nothing here limits liability for fraud or
          for anything that cannot legally be limited.
        </p>
      </SiteSection>

      <SiteSection title="Ending it">
        <p>
          You can stop at any time by deleting your account. An account can be suspended
          or removed if it is used to break these terms or to damage the service for other
          people. Where that is reasonable, you will be told why.
        </p>
      </SiteSection>

      <SiteSection title="Changes to these terms">
        <p>
          When these terms change, the date at the top changes too, and a material change
          is announced in the app. Continuing to use the service after a change means
          accepting the new version.
        </p>
      </SiteSection>

      <SiteSection title="Law, and how to reach a person">
        <p>
          These terms are governed by the laws of India. Questions, complaints and bug
          reports go to {MAKER}, who can be reached through{' '}
          <a href={GITHUB} className="link-sweep text-ink">
            GitHub
          </a>
          . What is collected and stored is set out in the{' '}
          <Link href="/privacy" className="link-sweep text-ink">
            privacy policy
          </Link>
          .
        </p>
      </SiteSection>
    </>
  );
}
