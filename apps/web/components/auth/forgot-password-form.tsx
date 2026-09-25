'use client';

import { ApiError } from '@recallify/core';
import Link from 'next/link';
import { useState } from 'react';
import { Stagger, StaggerItem } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { TextField, fieldError } from '@/components/ui/field';
import { messageOf } from '@/components/ui/misc';
import { forgotPassword } from '@/lib/auth';

const backToSignIn =
  'font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const errors = error instanceof ApiError ? error.fieldErrors : undefined;
  const hasFieldErrors = errors && Object.keys(errors).length > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword({ email });
      setSent(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Stagger gap={0.09} className="w-full max-w-100">
        <StaggerItem>
          <p className="eyebrow">Check your inbox</p>
          <h1 className="font-display mt-3 text-[40px] font-semibold leading-[1.02] text-ink sm:text-[52px]">
            The link is on its way.
          </h1>
          <p className="mt-4 text-ui text-ink-muted">
            If <span className="text-ink">{email}</span> has an account, an email with a
            reset link is on its way. It works for 30 minutes. If nothing arrives, check
            the spam folder, and make sure the address is the one you signed up with.
          </p>
        </StaggerItem>
        <StaggerItem as="p" className="mt-8 text-ui text-ink-muted">
          <Link href="/login" className={backToSignIn}>
            Back to sign in
          </Link>
        </StaggerItem>
      </Stagger>
    );
  }

  return (
    <Stagger gap={0.09} delay={0.1} className="w-full max-w-100">
      <StaggerItem>
        <h1 className="font-display text-[40px] font-semibold leading-[1.02] text-ink sm:text-[52px]">
          Reset your password
        </h1>
        <p className="mt-3 text-ui text-ink-muted">
          Enter the email you signed up with and we will send a link for choosing a new
          one.
        </p>
      </StaggerItem>

      <StaggerItem>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-5" noValidate>
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            error={fieldError(errors, 'email')}
          />

          {error && !hasFieldErrors ? (
            <p
              role="alert"
              className="rounded-md border border-danger/40 px-3 py-2 text-ui text-danger"
            >
              {messageOf(error)}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!email}>
            Send the link
          </Button>
        </form>
      </StaggerItem>

      <StaggerItem as="p" className="mt-6 text-ui text-ink-muted">
        Remembered it?{' '}
        <Link href="/login" className={backToSignIn}>
          Sign in
        </Link>
      </StaggerItem>
    </Stagger>
  );
}
