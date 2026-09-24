'use client';

import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EASE } from '@/components/motion';
import { Logo } from '@/components/shell/logo';
import { LinkButton } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export const SITE_NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/android', label: 'Android app' },
  { href: '/about', label: 'About' },
] as const;

/**
 * The site header.
 *
 * One call to action, and only one. The earlier version offered "Sign in" and
 * "Create account" in the bar, again in the hero, again at the foot of the
 * page and again in the footer, which reads as a page that is anxious about
 * being left.
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  // A menu that survives navigation would sit over the page it opened.
  useEffect(() => setOpen(false), [pathname]);

  // The page behind an open sheet must not scroll with it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300',
        scrolled || open ? 'border-line bg-paper' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-8">
        <Logo />

        <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
          {SITE_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-ui font-medium transition-colors duration-200',
                  active ? 'text-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                <span className={cn(active ? '' : 'link-sweep')}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <LinkButton href="/today" variant="primary">
              Open the app
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" className="hidden sm:inline-flex">
                Sign in
              </LinkButton>
              <LinkButton href="/register" variant="primary">
                Get started
              </LinkButton>
            </>
          )}

          <button
            type="button"
            aria-label={open ? 'Close the menu' : 'Open the menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface-alt md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            aria-label="Site"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden border-t border-line bg-paper md:hidden"
          >
            <ul className="mx-auto flex max-w-[1240px] flex-col px-4 py-2 sm:px-8">
              {SITE_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block border-b border-line py-3.5 text-body font-medium text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              {!signedIn ? (
                <li>
                  <Link
                    href="/login"
                    className="block py-3.5 text-body font-medium text-ink"
                  >
                    Sign in
                  </Link>
                </li>
              ) : null}
            </ul>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
