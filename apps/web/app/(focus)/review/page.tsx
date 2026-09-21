import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReviewView } from '@/components/review/review-view';

export const metadata: Metadata = { title: 'Review' };

/**
 * Outside the app shell on purpose. A review session is the one screen where
 * navigation is a distraction, so it gets the whole viewport and one way out.
 */
export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewView />
    </Suspense>
  );
}
