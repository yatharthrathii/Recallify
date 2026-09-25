import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Choose a new password',
  // A page reached only from an email has no business in a search index.
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    // useSearchParams (for ?token=) needs a boundary to prerender under.
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
