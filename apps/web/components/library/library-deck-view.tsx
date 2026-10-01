'use client';

import { ApiError, formatCount, formatDate, formatFollowers } from '@recallify/core';
import { useLibraryDeck, useSubscribe } from '@recallify/core/react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DeckSwatch } from '@/components/decks/deck-swatch';
import { PageShell, Section } from '@/components/shell/app-shell';
import { Button, LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, Skeleton, messageOf } from '@/components/ui/misc';
import { Changelog } from './changelog';

export function LibraryDeckView({ deckId }: { deckId: string }) {
  const router = useRouter();
  const deck = useLibraryDeck(deckId);
  const subscribe = useSubscribe();

  if (deck.isError) {
    const missing = deck.error instanceof ApiError && deck.error.status === 404;
    return (
      <PageShell title={missing ? 'Not in the library' : 'Library'}>
        {missing ? (
          <EmptyState
            title="This deck is not in the library"
            body="The author may have taken it out, or the link is wrong. Anyone already following it keeps their copy."
            action={<LinkButton href="/library">Back to the library</LinkButton>}
          />
        ) : (
          <ErrorState error={deck.error} onRetry={() => void deck.refetch()} />
        )}
      </PageShell>
    );
  }

  const d = deck.data;
  // Only the author sees a deck of theirs that is not published.
  const unpublished = d ? d.isMine && !d.publishedAt : false;

  return (
    <PageShell
      eyebrow={
        <Link
          href="/library"
          className="inline-flex items-center gap-1.5 text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Library
        </Link>
      }
      title={
        d ? (
          <span className="flex items-center gap-3">
            <DeckSwatch color={d.color} className="size-4" />
            <span className="min-w-0 break-words">{d.title}</span>
          </span>
        ) : (
          <Skeleton className="h-9 w-64" />
        )
      }
      description={
        d ? (
          <>
            {d.description ? <span className="block">{d.description}</span> : null}
            <span className="block">
              By {d.authorName}. {formatCount(d.cardCount)} {d.cardCount === 1 ? 'card' : 'cards'},{' '}
              {formatFollowers(d.subscriberCount)}
              {d.publishedAt ? `, published ${formatDate(d.publishedAt)}.` : '.'}
            </span>
          </>
        ) : undefined
      }
      actions={
        d ? (
          d.isMine ? (
            <>
              {unpublished ? <Badge>Not in the library</Badge> : null}
              <LinkButton href={`/decks/${d.id}`}>Open your deck</LinkButton>
            </>
          ) : d.subscribedDeckId ? (
            <>
              <Badge tone="info">Following</Badge>
              <LinkButton href={`/decks/${d.subscribedDeckId}`} variant="primary">
                Open your copy
              </LinkButton>
            </>
          ) : (
            <Button
              variant="primary"
              loading={subscribe.isPending}
              onClick={() =>
                subscribe.mutate(d.id, {
                  onSuccess: (copy) => {
                    toast.success('Following. The cards are yours now.');
                    router.push(`/decks/${copy.id}`);
                  },
                  onError: (error) => toast.error(messageOf(error)),
                })
              }
            >
              Follow this deck
            </Button>
          )
        ) : undefined
      }
    >
      {unpublished ? (
        <p className="mb-8 max-w-[64ch] text-ui text-ink-muted">
          This is what followers will see once you publish it. Nobody else can open this
          page until then.
        </p>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Section
          title="A look inside"
          aside={
            d && d.sampleCards.length > 0 && d.sampleCards.length < d.cardCount
              ? `First ${d.sampleCards.length} of ${formatCount(d.cardCount)}`
              : undefined
          }
        >
          {!d ? (
            <Skeleton className="h-40 w-full" />
          ) : d.sampleCards.length === 0 ? (
            <p className="text-ui text-ink-muted">No cards yet.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {d.sampleCards.map((card, i) => (
                <li key={i} className="grid gap-x-4 gap-y-0.5 px-4 py-3 sm:grid-cols-2 sm:px-5">
                  <span className="line-clamp-2 text-ui font-medium text-ink">{card.front}</span>
                  <span className="line-clamp-2 text-ui text-ink-muted">{card.back}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="What the author changed">
          {!d ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Changelog
              changes={d.changes}
              empty="Nothing since it was published. Every card the author adds, edits or removes will be listed here."
            />
          )}
        </Section>
      </div>

      {d && !d.isMine ? (
        <p className="mt-10 max-w-[64ch] text-caption text-ink-muted">
          Following makes a copy in your account, every card new, scheduled by your own
          answers. The author&rsquo;s later edits reach your copy as text only; your
          progress on a card is never reset, and a card the author removes is suspended
          in your copy rather than deleted.
        </p>
      ) : null}
    </PageShell>
  );
}
