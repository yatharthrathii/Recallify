import type { Metadata } from 'next';
import { DeckView } from '@/components/decks/deck-view';

export const metadata: Metadata = { title: 'Deck' };

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeckView deckId={id} />;
}
