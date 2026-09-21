import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    // useSearchParams (for ?next=) needs a boundary to prerender under.
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
