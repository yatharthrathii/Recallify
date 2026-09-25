'use client';

import { ApiError } from '@recallify/core';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Stagger, StaggerItem } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { PasswordField, TextField, fieldError } from '@/components/ui/field';
import { messageOf } from '@/components/ui/misc';
import { DemoButton } from './demo-button';
import { login, register } from '@/lib/auth';

/** Only ever send someone to a path on this site. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/today';
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const errors = error instanceof ApiError ? error.fieldErrors : undefined;
  const hasFieldErrors = errors && Object.keys(errors).length > 0;
  const isRegister = mode === 'register';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isRegister) {
        const display = name.trim();
        await register({ email, password, ...(display ? { displayName: display } : {}) });
      } else {
        await login({ email, password });
      }
      // Whatever a previous account left in the cache is not this one's.
      queryClient.clear();
      toast.success(isRegister ? 'Account created. Make your first deck.' : 'Signed in.');
      router.replace(safeNext(params.get('next')));
      router.refresh();
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  };

  return (
    <Stagger gap={0.09} delay={0.1} className="w-full max-w-100">
      <StaggerItem>
        <h1 className="font-display text-[40px] font-semibold leading-[1.02] text-ink sm:text-[52px]">
          {isRegister ? 'Create your account' : 'Sign in'}
        </h1>
        <p className="mt-3 text-ui text-ink-muted">
          {isRegister
            ? 'Free, and it takes an email and a password. No card, no trial clock.'
            : 'Your cards are where you left them.'}
        </p>
      </StaggerItem>

      <StaggerItem>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-5" noValidate>
          {isRegister ? (
            <TextField
              label="Name"
              aside="Optional"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={60}
              error={fieldError(errors, 'displayName')}
            />
          ) : null}
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
          <PasswordField
            label="Password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aside={
              isRegister ? undefined : (
                <Link
                  href="/forgot-password"
                  className="link-sweep text-caption font-medium text-ink-muted hover:text-ink"
                >
                  Forgot password?
                </Link>
              )
            }
            hint={
              isRegister
                ? 'At least 10 characters. Length matters more than symbols.'
                : undefined
            }
            error={fieldError(errors, 'password')}
          />

          {error && !hasFieldErrors ? (
            <p
              role="alert"
              className="rounded-md border border-danger/40 px-3 py-2 text-ui text-danger"
            >
              {messageOf(error)}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={busy}
            disabled={!email || !password}
          >
            {isRegister ? 'Create account' : 'Sign in'}
          </Button>
        </form>
      </StaggerItem>

      <StaggerItem as="p" className="mt-6 text-ui text-ink-muted">
        {isRegister ? 'Already have an account?' : 'New here?'}{' '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          {isRegister ? 'Sign in' : 'Create an account'}
        </Link>
      </StaggerItem>

      <StaggerItem as="p" className="mt-3 text-ui text-ink-muted">
        Just looking? <DemoButton>Open the demo</DemoButton>
      </StaggerItem>
    </Stagger>
  );
}
