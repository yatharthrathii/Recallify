'use client';

import { useDecks } from '@recallify/core/react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { applyTheme } from '@/lib/theme';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}

const item =
  'flex h-10 cursor-default select-none items-center justify-between gap-3 rounded-sm px-3 text-ui text-ink data-[selected=true]:bg-surface-alt';
const heading =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-faint';

/** Ctrl or Cmd K. Everything the sidebar does, without the mouse. */
export function CommandPalette({ open, onOpenChange, onSignOut }: Props) {
  const router = useRouter();
  const decks = useDecks();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-40 bg-ink/35 animate-fade-in"
      contentClassName="fixed left-1/2 top-[12dvh] z-50 w-[calc(100vw-32px)] max-w-140 -translate-x-1/2 overflow-hidden rounded-lg border border-line-strong bg-surface shadow-[var(--shadow-md)] animate-pop-in"
    >
      <Command.Input
        placeholder="Go to a page, open a deck, change the theme"
        className="h-12 w-full border-b border-line bg-transparent px-4 text-body text-ink outline-none placeholder:text-ink-faint"
      />
      <Command.List className="scroll-quiet max-h-[52dvh] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-ui text-ink-muted">
          Nothing matches that.
        </Command.Empty>

        <Command.Group heading="Go to" className={heading}>
          <Command.Item className={item} onSelect={() => go('/review')}>
            Start review
          </Command.Item>
          <Command.Item className={item} onSelect={() => go('/today')}>
            Today
          </Command.Item>
          <Command.Item className={item} onSelect={() => go('/decks')}>
            Decks
          </Command.Item>
          <Command.Item className={item} onSelect={() => go('/stats')}>
            Stats
          </Command.Item>
          <Command.Item className={item} onSelect={() => go('/settings')}>
            Settings
          </Command.Item>
        </Command.Group>

        {decks.data && decks.data.items.length > 0 ? (
          <Command.Group heading="Decks" className={heading}>
            {decks.data.items.map((deck) => (
              <Command.Item
                key={deck.id}
                value={`deck ${deck.title}`}
                className={item}
                onSelect={() => go(`/decks/${deck.id}`)}
              >
                <span className="truncate">{deck.title}</span>
                <span className="tabular shrink-0 text-caption text-ink-faint">
                  {deck.dueCount} due
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        <Command.Group heading="Appearance" className={heading}>
          <Command.Item
            className={item}
            onSelect={() => (applyTheme('light'), onOpenChange(false))}
          >
            Light theme
          </Command.Item>
          <Command.Item
            className={item}
            onSelect={() => (applyTheme('dark'), onOpenChange(false))}
          >
            Dark theme
          </Command.Item>
          <Command.Item
            className={item}
            onSelect={() => (applyTheme('system'), onOpenChange(false))}
          >
            Match the system
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Account" className={heading}>
          <Command.Item
            className={item}
            onSelect={() => {
              onOpenChange(false);
              onSignOut();
            }}
          >
            Sign out
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
