import type { Metadata } from 'next';
import { Logo } from '@/components/shell/logo';
import { LinkButton } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/**
 * What the service worker shows for an app page this device has never
 * opened. Static, so it is cached on install and always there.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-170 flex-col px-4 sm:px-8">
      <header className="flex h-16 items-center">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col justify-center pb-24">
        <p className="eyebrow">No connection</p>
        <h1 className="font-display mt-2 text-h1 font-semibold text-ink">
          This page has not been opened on this device yet.
        </h1>
        <p className="mt-3 max-w-[56ch] text-ui text-ink-muted">
          Pages you have opened while online open again without a connection, and so
          does the review screen with the cards it last loaded. Answers you give offline
          are kept on this device and sent when the connection comes back.
        </p>
        <div className="mt-8">
          <LinkButton href="/review" variant="primary">
            Open the review screen
          </LinkButton>
        </div>
      </main>
    </div>
  );
}
