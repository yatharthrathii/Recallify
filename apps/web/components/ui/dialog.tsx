'use client';

import * as AlertPrimitive from '@radix-ui/react-alert-dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button, IconButton } from './button';

const overlay = 'fixed inset-0 z-40 bg-ink/35 animate-fade-in';

/**
 * A sheet from the bottom on phones, a centred panel from `sm` up. On a small
 * screen a centred modal leaves the buttons in the hardest place to reach.
 */
const panel = cn(
  'fixed z-50 flex max-h-[92dvh] w-full flex-col border border-line-strong bg-surface shadow-[var(--shadow-md)]',
  'inset-x-0 bottom-0 rounded-t-lg animate-sheet-in pb-[env(safe-area-inset-bottom)]',
  'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:animate-pop-in sm:pb-0',
);

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Panel width from `sm` up. */
  size?: 'sm' | 'md' | 'lg';
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlay} />
        <DialogPrimitive.Content
          className={cn(
            panel,
            size === 'sm' && 'sm:max-w-[420px]',
            size === 'md' && 'sm:max-w-[560px]',
            size === 'lg' && 'sm:max-w-[760px]',
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-h3 font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-ui text-ink-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close" className="-mr-2 -mt-1">
                <X className="size-4" />
              </IconButton>
            </DialogPrimitive.Close>
          </header>
          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {children}
          </div>
          {footer ? (
            <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
              {footer}
            </footer>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
  children?: ReactNode;
}

/** For anything that cannot be undone. Says what will be lost, in words. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading = false,
  danger = true,
  children,
}: ConfirmProps) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlay} />
        <AlertPrimitive.Content className={cn(panel, 'sm:max-w-[440px]')}>
          <div className="px-5 pt-5">
            <AlertPrimitive.Title className="text-h3 font-semibold text-ink">
              {title}
            </AlertPrimitive.Title>
            <AlertPrimitive.Description className="mt-2 text-ui text-ink-muted">
              {description}
            </AlertPrimitive.Description>
            {children ? <div className="mt-4">{children}</div> : null}
          </div>
          <footer className="flex flex-col-reverse gap-2 px-5 py-5 sm:flex-row sm:justify-end">
            <AlertPrimitive.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertPrimitive.Cancel>
            <Button
              variant={danger ? 'danger' : 'primary'}
              loading={loading}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </footer>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}
