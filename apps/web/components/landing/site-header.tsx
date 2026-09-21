'use client';

import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useState } from 'react';
import { EASE } from '@/components/motion';
import { Logo } from '@/components/shell/logo';
import { LinkButton } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * Drops in on load, then stays with the reader. It is bare over the hero and
 * picks up a hairline once the page has moved, so it never sits as a bar
 * across the top of the headline.
 */
export function SiteHeader({ signedIn, repo }: { signedIn: boolean; repo: string }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300',
        scrolled ? 'border-line bg-paper' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-8">
        <Logo />
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
          <a
            href={repo}
            className="hidden h-10 items-center px-3 text-ui font-medium text-ink-muted transition-colors hover:text-ink sm:inline-flex"
          >
            <span className="link-sweep">Source</span>
          </a>
          {signedIn ? (
            <LinkButton href="/today" variant="primary">
              Open the app
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost">
                Sign in
              </LinkButton>
              <LinkButton href="/register" variant="primary">
                Create account
              </LinkButton>
            </>
          )}
        </nav>
      </div>
    </motion.header>
  );
}
