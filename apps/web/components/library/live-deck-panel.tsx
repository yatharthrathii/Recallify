'use client';

import type { Deck } from '@recallify/contracts';
import { formatCount, formatDate, formatFollowers } from '@recallify/core';
import {
  useAddDeckNote,
  useDeckChanges,
  useSubscription,
  useSyncSubscription,
} from '@recallify/core/react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Section } from '@/components/shell/app-shell';
import { Button, LinkButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextArea } from '@/components/ui/field';
import { ErrorState, Skeleton, messageOf } from '@/components/ui/misc';
import { Changelog } from './changelog';

const NOTE_MAX = 500;

/**
 * The live-deck strip on a deck page.
 *
 * For a published deck: how many follow it, a link to its library page, a
 * note box, and its changelog. For a subscribed copy: the source, what has
 * changed since the last update, and the update itself, which runs once on
 * arrival so the deck is current before the first card is turned.
 */
export function LiveDeckPanel({ deck }: { deck: Deck }) {
  if (deck.sourceDeckId) return <FollowerPanel deck={deck} />;
  if (deck.isPublic) return <AuthorPanel deck={deck} />;
  return null;
}

function AuthorPanel({ deck }: { deck: Deck }) {
  const changes = useDeckChanges(deck.id);
  const [noting, setNoting] = useState(false);
  const [text, setText] = useState('');
  const note = useAddDeckNote();

  return (
    <Section
      title="In the library"
      className="mb-10"
      aside={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            <span className="tabular text-ink">{formatFollowers(deck.subscriberCount)}</span>
            {deck.publishedAt ? `, since ${formatDate(deck.publishedAt)}` : ''}
          </span>
          <LinkButton href={`/library/${deck.id}`} size="sm" variant="ghost">
            Library page
            <ArrowUpRight className="size-3.5" />
          </LinkButton>
        </span>
      }
    >
      <p className="mb-4 max-w-[64ch] text-ui text-ink-muted">
        Every card you add, edit or remove is listed here and reaches your followers the
        next time they open their copy. Your edits change a card&rsquo;s text only; their
        progress on it stays theirs. A note tells them why.
      </p>
      <div className="mb-4">
        <Button size="sm" onClick={() => setNoting(true)}>
          Add a note
        </Button>
      </div>
      {changes.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : changes.isError ? (
        <ErrorState error={changes.error} onRetry={() => void changes.refetch()} />
      ) : (
        <>
          <Changelog
            changes={changes.data?.pages.flatMap((page) => page.items) ?? []}
            empty="No changes since publishing. They appear here as you make them."
          />
          {changes.hasNextPage ? (
            <div className="mt-3">
              <Button
                size="sm"
                variant="ghost"
                loading={changes.isFetchingNextPage}
                onClick={() => void changes.fetchNextPage()}
              >
                Show older
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={noting}
        onOpenChange={setNoting}
        title="A note for followers"
        description="Why the deck changed, in a sentence or two. It goes at the top of the changelog."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoting(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={text.trim().length === 0}
              loading={note.isPending}
              onClick={() =>
                note.mutate(
                  { deckId: deck.id, text: text.trim() },
                  {
                    onSuccess: () => {
                      toast.success('Note added.');
                      setText('');
                      setNoting(false);
                    },
                    onError: (error) => toast.error(messageOf(error)),
                  },
                )
              }
            >
              Add note
            </Button>
          </>
        }
      >
        <TextArea
          label="Note"
          value={text}
          maxLength={NOTE_MAX}
          onChange={(event) => setText(event.target.value)}
          aside={`${formatCount(text.length)} / ${NOTE_MAX}`}
        />
      </Dialog>
    </Section>
  );
}

function FollowerPanel({ deck }: { deck: Deck }) {
  const status = useSubscription(deck.id);
  const sync = useSyncSubscription();
  const { mutate, isPending } = sync;
  // Once per visit, and only when there is something to take, so the page
  // does not write on every open. A failed attempt lets the next status
  // refetch try again, and the button is always there.
  const attempted = useRef(false);

  useEffect(() => {
    const s = status.data;
    if (!s || !s.source || attempted.current || isPending) return;
    const { added, edited, removed } = s.pending;
    if (added + edited + removed === 0) return;
    attempted.current = true;
    mutate(deck.id, {
      onSuccess: (result) => toast(describe(result)),
      onError: (error) => {
        attempted.current = false;
        toast.error(messageOf(error));
      },
    });
  }, [status.data, mutate, isPending, deck.id]);

  const s = status.data;

  return (
    <Section title="Following" className="mb-10">
      {status.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : status.isError ? (
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      ) : !s ? null : !s.source ? (
        <p className="max-w-[64ch] text-ui text-ink-muted">
          The author has taken this deck out of the library. Your copy stays exactly as it
          is: every card, every review. Nothing more will arrive.
        </p>
      ) : (
        <>
          <p className="text-ui text-ink-muted">
            A copy of{' '}
            <Link
              href={`/library/${s.source.id}`}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              {s.source.title}
            </Link>{' '}
            by {s.source.authorName}.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-ui text-ink-muted">
              {s.syncedAt ? (
                <>
                  Last brought up to date{' '}
                  <span className="tabular text-ink">{formatDate(s.syncedAt)}</span>.{' '}
                </>
              ) : null}
              {s.pending.added + s.pending.edited + s.pending.removed > 0 ? (
                <span className="text-ink">Waiting: {parts(s.pending)}.</span>
              ) : (
                'Up to date with the author.'
              )}
            </p>
            <Button
              size="sm"
              loading={isPending}
              onClick={() =>
                mutate(deck.id, {
                  onSuccess: (result) => toast(describe(result)),
                  onError: (error) => toast.error(messageOf(error)),
                })
              }
            >
              <RefreshCw className="size-3.5" />
              Bring up to date
            </Button>
          </div>
          {s.changes.length > 0 ? (
            <div className="mt-5">
              <p className="eyebrow mb-2">Since your last update</p>
              <Changelog changes={s.changes} />
            </div>
          ) : null}
          <p className="mt-4 max-w-[72ch] text-caption text-ink-muted">
            The author&rsquo;s edits change a card&rsquo;s text only; your stability, due
            dates and history stay as they are. A card the author removes is suspended
            here, not deleted. To drop a card yourself, suspend it: while you follow, a
            deleted card would come back.{' '}
            <Link href={`/library/${s.source.id}`} className="underline underline-offset-4">
              Changelog
            </Link>
            .
          </p>
        </>
      )}
    </Section>
  );
}

function parts(p: { added: number; edited: number; removed: number }): string {
  const out: string[] = [];
  if (p.added) out.push(`${formatCount(p.added)} new ${p.added === 1 ? 'card' : 'cards'}`);
  if (p.edited) out.push(`${formatCount(p.edited)} edited`);
  if (p.removed) out.push(`${formatCount(p.removed)} removed`);
  return out.join(', ');
}

function describe(result: { added: number; edited: number; removed: number }): string {
  if (result.added + result.edited + result.removed === 0) return 'Already up to date.';
  return `Brought up to date: ${parts(result)}. Your progress is untouched.`;
}
