'use client';

import { ApiError } from '@recallify/core';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Stagger, StaggerItem } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { PasswordField, fieldError } from '@/components/ui/field';
import { messageOf } from '@/components/ui/misc';
import { resetPassword } from '@/lib/auth';

const linkStyle =
  'font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink';

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const errors = error instanceof ApiError ? error.fieldErrors : undefined;
  const hasFieldErrors = errors && Object.keys(errors).length > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resetPassword({ token, password });
      toast.success('Password changed. Sign in with the new one.');
      router.replace('/login');
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  // A link with no token is not a link that can work. Say so rather than
  // reject a password the person has just typed.
  if (!token) {
    return (
      <Stagger gap={0.09} className="w-full max-w-100">
        <StaggerItem>
          <h1 className="font-display text-[40px] font-semibold leading-[1.02] text-ink sm:text-[52px]">
            This link is incomplete.
          </h1>
          <p className="mt-4 text-ui text-ink-muted">
            Open the link from the email again, or ask for a new one. Some email apps cut
            long links in half.
          </p>
        </StaggerItem>
        <StaggerItem as="p" className="mt-8 text-ui text-ink-muted">
          <Link href="/forgot-password" className={linkStyle}>
            Ask for a new link
          </Link>
        </StaggerItem>
      </Stagger>
    );
  }

  return (
    <Stagger gap={0.09} delay={0.1} className="w-full max-w-100">
      <StaggerItem>
        <h1 className="font-display text-[40px] font-semibold leading-[1.02] text-ink sm:text-[52px]">
          Choose a new password
        </h1>
        <p className="mt-3 text-ui text-ink-muted">
          Every device signed in to this account will be signed out, and only the new
          password will work from here on.
        </p>
      </StaggerItem>

      <StaggerItem>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-5" noValidate>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            hint="At least 10 characters. Length matters more than symbols."
            error={fieldError(errors, 'password')}
          />

          {error && !hasFieldErrors ? (
            <p
              role="alert"
              className="rounded-md border border-danger/40 px-3 py-2 text-ui text-danger"
            >
              {messageOf(error)}{' '}
              <Link href="/forgot-password" className={linkStyle}>
                Ask for a new link
              </Link>
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={busy}
            disabled={password.length < 10}
          >
            Set the new password
          </Button>
        </form>
      </StaggerItem>
    </Stagger>
  );
}
