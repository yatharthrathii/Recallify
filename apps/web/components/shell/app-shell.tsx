'use client';

import { useMe, useOverview } from '@recallify/core/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  ChevronsUpDown,
  Layers,
  LogOut,
  Search,
  Settings,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { EASE, Reveal } from '@/components/motion';
import { LinkButton } from '@/components/ui/button';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  TooltipProvider,
} from '@/components/ui/controls';
import { Kbd, Skeleton } from '@/components/ui/misc';
import { logout } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { applyTheme } from '@/lib/theme';
import { CommandPalette } from './command-palette';
import { Logo } from './logo';

const NAV = [
  { href: '/today', label: 'Today', icon: CalendarDays },
  { href: '/decks', label: 'Decks', icon: Layers },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const overview = useOverview();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const signOut = async () => {
    try {
      await logout();
    } catch {
      toast.error('Could not reach the server. You are still signed in on this device.');
      return;
    }
    // Another account must never see this one's cached decks.
    queryClient.clear();
    toast('Signed out.');
    router.replace('/login');
  };

  const due = overview.data?.dueToday ?? 0;
  const name = me.data?.displayName ?? me.data?.email ?? '';

  const userMenu = (
    <MenuContent align="start" className="w-60">
      <MenuLabel>Theme</MenuLabel>
      <MenuItem onSelect={() => applyTheme('light')}>Light</MenuItem>
      <MenuItem onSelect={() => applyTheme('dark')}>Dark</MenuItem>
      <MenuItem onSelect={() => applyTheme('system')}>Match the system</MenuItem>
      <MenuSeparator />
      <MenuItem onSelect={() => void signOut()}>
        <LogOut className="size-4 text-ink-muted" />
        Sign out
      </MenuItem>
    </MenuContent>
  );

  return (
    <TooltipProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-ui focus:text-paper"
      >
        Skip to content
      </a>

      {/* Sidebar, from lg up. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-paper lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href="/today" />
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-ui text-ink-faint transition-colors duration-[90ms] hover:border-line-strong hover:text-ink-muted"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search</span>
            <Kbd>Ctrl K</Kbd>
          </button>
        </div>

        <nav aria-label="Main" className="mt-4 flex flex-col gap-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 items-center gap-2.5 rounded-md px-3 text-ui font-medium transition-colors duration-200',
                  active
                    ? 'text-paper'
                    : 'text-ink-muted hover:bg-surface-alt hover:text-ink',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md bg-ink"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <Icon className="relative size-4" />
                <span className="relative flex-1">{label}</span>
                {href === '/today' && due > 0 ? (
                  <span
                    className={cn(
                      'tabular relative text-caption',
                      active ? 'text-paper/80' : 'text-accent',
                    )}
                  >
                    {due}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 p-3">
          <LinkButton href="/review" variant="primary" className="w-full">
            {due > 0 ? (
              <>
                Review <span className="tabular opacity-70">{due}</span>
              </>
            ) : (
              'Review'
            )}
          </LinkButton>

          <Menu>
            <MenuTrigger className="flex h-11 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors duration-[90ms] hover:bg-surface-alt">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-caption font-medium uppercase text-ink-muted">
                {name.slice(0, 1) || '?'}
              </span>
              <span className="min-w-0 flex-1">
                {me.isLoading ? (
                  <Skeleton className="h-3 w-24" />
                ) : (
                  <span className="block truncate text-ui text-ink">{name}</span>
                )}
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-ink-faint" />
            </MenuTrigger>
            {userMenu}
          </Menu>
        </div>
      </aside>

      {/* Top bar, below lg. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
        <Logo href="/today" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Search"
            onClick={() => setPaletteOpen(true)}
            className="flex size-10 items-center justify-center rounded-md text-ink-muted hover:bg-surface-alt"
          >
            <Search className="size-5" />
          </button>
          <Menu>
            <MenuTrigger
              aria-label="Account"
              className="flex size-10 items-center justify-center rounded-md hover:bg-surface-alt"
            >
              <span className="flex size-7 items-center justify-center rounded-full border border-line-strong bg-surface text-caption font-medium uppercase text-ink-muted">
                {name.slice(0, 1) || '?'}
              </span>
            </MenuTrigger>
            {userMenu}
          </Menu>
        </div>
      </header>

      <main id="main" className="pb-24 lg:pb-0 lg:pl-60">
        {/* Keyed by path, so every page plays its own entrance once. The
            movement itself belongs to PageShell; this is only the cross-fade. */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>

      {/* Tab bar, below lg. Thumb reach beats a hamburger menu. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-[560px] grid-cols-5 items-center">
          {NAV.slice(0, 2).map((entry) => (
            <TabLink
              key={entry.href}
              {...entry}
              active={isActive(pathname, entry.href)}
            />
          ))}
          <div className="flex justify-center">
            <Link
              href="/review"
              aria-label={due > 0 ? `Review, ${due} due` : 'Review'}
              className="flex h-11 min-w-16 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-ui font-medium text-paper active:scale-[0.97]"
            >
              Review
              {due > 0 ? <span className="tabular opacity-70">{due}</span> : null}
            </Link>
          </div>
          {NAV.slice(2).map((entry) => (
            <TabLink
              key={entry.href}
              {...entry}
              active={isActive(pathname, entry.href)}
            />
          ))}
        </div>
      </nav>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSignOut={() => void signOut()}
      />
    </TooltipProvider>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium',
        active ? 'text-ink' : 'text-ink-faint',
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
      {label}
    </Link>
  );
}

/** Identical chrome for every page: width, header rhythm, spacing. */
export function PageShell({
  title,
  description,
  actions,
  eyebrow,
  children,
  width = 'app',
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  width?: 'app' | 'prose';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 pb-16 pt-6 sm:px-8 sm:pt-10',
        width === 'app' ? 'max-w-[1120px]' : 'max-w-[760px]',
      )}
    >
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <motion.div
              className="mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {eyebrow}
            </motion.div>
          ) : null}
          {/* The title is pushed up through a slot, the same move as the
              landing headline, so the app and the site feel like one thing. */}
          <div className="-mb-[0.14em] overflow-hidden pb-[0.14em]">
            <motion.h1
              className="font-display text-[34px] font-semibold leading-[1.02] text-ink sm:text-[48px]"
              initial={{ y: '105%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.05 }}
            >
              {title}
            </motion.h1>
          </div>
          {description ? (
            <motion.p
              className="mt-3 max-w-[64ch] text-ui text-ink-muted"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
            >
              {description}
            </motion.p>
          ) : null}
        </div>
        {actions ? (
          <motion.div
            className="flex shrink-0 flex-wrap items-center gap-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
          >
            {actions}
          </motion.div>
        ) : null}
      </header>
      {children}
    </div>
  );
}

/** A titled block inside a page. Hairline above, never a floating card. */
export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Reveal as="section" className={cn('border-t border-line-strong pt-5', className)}>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-h3 font-semibold text-ink">{title}</h2>
        {aside ? <div className="text-caption text-ink-muted">{aside}</div> : null}
      </div>
      {children}
    </Reveal>
  );
}
