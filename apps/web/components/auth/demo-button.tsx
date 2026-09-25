'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/button';
import { messageOf } from '@/components/ui/misc';
import { startDemo } from '@/lib/auth';
import { cn } from '@/lib/cn';

/**
 * Opens a private demo account with six months of history and goes straight
 * into it. Building the history takes a few seconds on a cold database, so the
 * button says what it is doing rather than looking stuck.
 */
export function DemoButton({
  className,
  children = 'Try the demo',
}: {
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      await startDemo();
      queryClient.clear();
      toast.success('Demo ready. Six months of reviews, all yours for a day.');
      router.replace('/today');
      router.refresh();
    } catch (error) {
      toast.error(messageOf(error));
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      aria-busy={busy || undefined}
      className={cn(
        'link-sweep inline-flex items-center gap-2 text-ui font-medium text-ink disabled:cursor-wait disabled:opacity-70',
        className,
      )}
    >
      {busy ? <Spinner /> : null}
      {busy ? 'Building six months of history' : children}
    </button>
  );
}
