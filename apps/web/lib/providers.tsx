'use client';

import { ApiError } from '@recallify/core';
import { ApiProvider, shouldRetry } from '@recallify/core/react';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { api } from './api';

/**
 * A 401 that survives the client's own refresh means the session is really
 * gone. Send the user to sign in, remembering where they were.
 */
function handleAuthLoss(error: unknown): void {
  if (!(error instanceof ApiError) || error.status !== 401) return;
  if (typeof window === 'undefined') return;
  const here = window.location.pathname + window.location.search;
  if (here.startsWith('/login') || here.startsWith('/register') || here === '/') return;
  window.location.assign(`/login?next=${encodeURIComponent(here)}`);
}

/**
 * The offline shell (public/sw.js). Production only: in development a cached
 * page is a stale page, and hot reload is what should win.
 */
function useServiceWorker(): void {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useServiceWorker();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleAuthLoss }),
        mutationCache: new MutationCache({ onError: handleAuthLoss }),
        defaultOptions: {
          queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={api}>
        {/* "user" follows prefers-reduced-motion for every motion component. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        {/* Sonner, dressed in the app's own colours: an ink slab that slides
            up from the corner, with the accent carried by the icon. Errors
            turn the whole slab, because they must not be missed. */}
        <Toaster
          position="bottom-right"
          gap={10}
          offset={20}
          mobileOffset={{ bottom: 88, left: 16, right: 16 }}
          duration={4200}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                'flex w-full items-center gap-3 rounded-lg bg-ink px-4 py-3.5 text-ui text-paper shadow-[var(--shadow-md)] sm:w-95',
              title: 'font-medium',
              description: 'text-paper/70',
              actionButton:
                'ml-auto shrink-0 rounded-sm border border-paper/40 px-2 py-1 text-caption font-medium',
              icon: 'flex size-6 shrink-0 items-center justify-center rounded-full bg-paper/15 text-paper [&>svg]:size-3.5',
              success: '[&_[data-icon]]:bg-accent',
              error: 'bg-danger!',
            },
          }}
        />
      </ApiProvider>
    </QueryClientProvider>
  );
}
