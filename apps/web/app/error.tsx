'use client';

import { Button } from '@/components/ui/button';

/** The last resort, for an error no screen handled. Says what is and is not lost. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[680px] flex-col justify-center px-4 sm:px-8">
      <h1 className="font-display text-h1 font-semibold text-ink">
        This screen stopped working.
      </h1>
      <p className="mt-3 text-ui text-ink-muted">
        Something in the page itself failed. Your cards and reviews live on the server and
        are not affected. Answers given in a session are kept on this device until they
        are sent.
      </p>
      {error.digest ? (
        <p className="mt-3 text-caption text-ink-faint">
          Reference <span className="tabular">{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-8">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
