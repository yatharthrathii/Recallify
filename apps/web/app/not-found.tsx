import { Logo } from '@/components/shell/logo';
import { LinkButton } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-170 flex-col px-4 sm:px-8">
      <header className="flex h-16 items-center">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col justify-center pb-24">
        <p className="tabular text-ui text-ink-faint">404</p>
        <h1 className="font-display mt-2 text-h1 font-semibold text-ink">
          There is no page here.
        </h1>
        <p className="mt-3 text-ui text-ink-muted">
          The link may be old, or the address mistyped. Nothing of yours is affected.
        </p>
        <div className="mt-8">
          <LinkButton href="/" variant="primary">
            Go to the front page
          </LinkButton>
        </div>
      </main>
    </div>
  );
}
