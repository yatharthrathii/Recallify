import Link from 'next/link';
import { Wordmark } from '@/components/landing/pieces';
import { Mark } from '@/components/shell/logo';
import { GITHUB, MAKER } from '@/lib/site';

const PRODUCT = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/android', label: 'Android app' },
] as const;

const COMPANY = [
  { href: '/about', label: 'About' },
  { href: '/terms', label: 'Terms of use' },
  { href: '/privacy', label: 'Privacy' },
] as const;

export function SiteFooter({ signedIn }: { signedIn: boolean }) {
  const year = new Date().getFullYear();

  // Someone already signed in has no use for an invitation to sign in.
  const product = signedIn
    ? [...PRODUCT, { href: '/today', label: 'Open the app' }]
    : [
        ...PRODUCT,
        { href: '/register', label: 'Create an account' },
        { href: '/login', label: 'Sign in' },
      ];

  const columns = [
    { title: 'Product', links: product },
    { title: 'Company', links: [...COMPANY] },
  ];

  return (
    <footer className="overflow-hidden border-t border-line-strong bg-surface">
      <div className="mx-auto max-w-310 px-4 pt-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <span className="flex items-center gap-2 text-ink">
              <Mark />
              <span className="font-display text-[20px] font-semibold leading-none">
                Recallify
              </span>
            </span>
            <p className="mt-4 max-w-[38ch] text-ui text-ink-muted">
              A flashcard app that schedules every card from your own answers, and shows
              you the reasoning instead of hiding it.
            </p>
            <p className="mt-6 text-ui text-ink-muted">
              Made in India by{' '}
              <a href={GITHUB} rel="me" className="link-sweep font-medium text-ink">
                {MAKER}
              </a>
              .
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="eyebrow">{column.title}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="link-sweep text-ui text-ink-muted hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line py-6 text-caption text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="tabular">{year}</span> Recallify. Scheduling uses FSRS, the
            work of Jarrett Ye and the Open Spaced Repetition community.
          </p>
          <a
            href={GITHUB}
            rel="me"
            className="link-sweep shrink-0 text-ink-muted hover:text-ink"
          >
            GitHub
          </a>
        </div>
      </div>

      <Wordmark />
    </footer>
  );
}
