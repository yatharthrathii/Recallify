import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DecksView } from '@/components/decks/decks-view';

export const metadata: Metadata = { title: 'Decks' };

export default function DecksPage() {
  return (
    <Suspense>
      <DecksView />
    </Suspense>
  );
}
