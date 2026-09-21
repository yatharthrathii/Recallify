'use client';

import type { Card } from '@recallify/contracts';
import { ApiError, describeInterval, formatDue } from '@recallify/core';
import {
  useCreateCard,
  useCurve,
  useDeleteCard,
  useSuspendCard,
  useUpdateCard,
} from '@recallify/core/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ForgettingCurve, fitYMin } from '@/components/curve/forgetting-curve';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { TextArea, TextField, fieldError } from '@/components/ui/field';
import { Skeleton, StateBadge, messageOf } from '@/components/ui/misc';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  /** Present when editing. */
  card?: Card;
}

export function CardDialog({ open, onOpenChange, deckId, card }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={card ? 'Card' : 'New card'}
      size={card ? 'lg' : 'md'}
    >
      {open ? (
        card ? (
          <EditCard card={card} onDone={() => onOpenChange(false)} />
        ) : (
          <NewCard deckId={deckId} onDone={() => onOpenChange(false)} />
        )
      ) : null}
    </Dialog>
  );
}

function NewCard({ deckId, onDone }: { deckId: string; onDone: () => void }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [hint, setHint] = useState('');
  const [added, setAdded] = useState(0);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const create = useCreateCard();
  const errors = create.error instanceof ApiError ? create.error.fieldErrors : undefined;

  const save = (keepOpen: boolean) => {
    const text = hint.trim();
    create.mutate(
      { deckId, front: front.trim(), back: back.trim(), ...(text ? { hint: text } : {}) },
      {
        onSuccess: () => {
          if (!keepOpen) {
            toast.success(added > 0 ? `${added + 1} cards added.` : 'Card added.');
            onDone();
            return;
          }
          // Writing cards is a run of the same action. Keep the hands on the
          // keyboard: clear, refocus, go again.
          setAdded((n) => n + 1);
          setFront('');
          setBack('');
          setHint('');
          frontRef.current?.focus();
        },
        onError: (error) => toast.error(messageOf(error)),
      },
    );
  };

  const ready = front.trim().length > 0 && back.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) save(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && ready) {
          event.preventDefault();
          save(true);
        }
      }}
    >
      <TextArea
        ref={frontRef}
        label="Front"
        hint="The question. One fact per card works best."
        value={front}
        onChange={(e) => setFront(e.target.value)}
        maxLength={4000}
        rows={3}
        autoFocus
        error={fieldError(errors, 'front')}
      />
      <TextArea
        label="Back"
        value={back}
        onChange={(e) => setBack(e.target.value)}
        maxLength={4000}
        rows={3}
        error={fieldError(errors, 'back')}
      />
      <TextField
        label="Hint"
        aside="Optional"
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        maxLength={500}
        error={fieldError(errors, 'hint')}
      />

      <div className="flex flex-col-reverse items-stretch gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
        {added > 0 ? (
          <span className="tabular mr-auto text-caption text-ink-muted">
            {added} added so far
          </span>
        ) : null}
        <Button variant="ghost" onClick={onDone}>
          {added > 0 ? 'Done' : 'Cancel'}
        </Button>
        <Button onClick={() => save(false)} disabled={!ready} loading={create.isPending}>
          Save and close
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!ready}
          loading={create.isPending}
        >
          Save and add another
        </Button>
      </div>
    </form>
  );
}

function EditCard({ card, onDone }: { card: Card; onDone: () => void }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [hint, setHint] = useState(card.hint ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = useUpdateCard();
  const suspend = useSuspendCard();
  const remove = useDeleteCard();
  const curve = useCurve({ cardId: card.id }, card.state !== 'NEW');
  const errors = update.error instanceof ApiError ? update.error.fieldErrors : undefined;

  const dirty = front !== card.front || back !== card.back || hint !== (card.hint ?? '');

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate(
            {
              id: card.id,
              body: { front: front.trim(), back: back.trim(), hint: hint.trim() },
            },
            {
              onSuccess: () => {
                toast.success('Card saved. Its schedule is unchanged.');
                onDone();
              },
              onError: (error) => toast.error(messageOf(error)),
            },
          );
        }}
      >
        <TextArea
          label="Front"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          maxLength={4000}
          rows={4}
          error={fieldError(errors, 'front')}
        />
        <TextArea
          label="Back"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          maxLength={4000}
          rows={4}
          error={fieldError(errors, 'back')}
        />
        <TextField
          label="Hint"
          aside="Optional"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={500}
        />
        <p className="text-caption text-ink-muted">
          Editing the text never resets the schedule. The memory is of the idea, not the
          wording.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              loading={suspend.isPending}
              onClick={() =>
                suspend.mutate(
                  { id: card.id, suspended: !card.suspendedAt },
                  {
                    onSuccess: () => {
                      toast.success(
                        card.suspendedAt
                          ? 'Card is back in the queue.'
                          : 'Card suspended. Its history is kept.',
                      );
                      onDone();
                    },
                    onError: (error) => toast.error(messageOf(error)),
                  },
                )
              }
            >
              {card.suspendedAt ? 'Unsuspend' : 'Suspend'}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={!dirty}
            loading={update.isPending}
          >
            Save changes
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-5 border-t border-line pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Memory</span>
          <StateBadge state={card.state} />
        </div>

        {card.state === 'NEW' ? (
          <p className="text-ui text-ink-muted">
            Not reviewed yet, so there is no memory to measure. The curve starts with the
            first answer.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Fact
                term="Stability"
                value={describeInterval(card.stability)}
                note="Time for recall to fall to 90%"
              />
              <Fact
                term="Difficulty"
                value={`${card.difficulty.toFixed(1)} / 10`}
                note="Intrinsic to the card"
              />
              <Fact term="Due" value={formatDue(card.dueAt)} />
              <Fact term="Reviews" value={`${card.reps}, ${card.lapses} lapsed`} />
            </dl>

            {curve.isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : curve.data ? (
              <ForgettingCurve
                points={curve.data.points}
                markers={curve.data.markers}
                desiredRetention={curve.data.desiredRetention}
                dueInDays={curve.data.dueInDays}
                xLabel="Days since the first review, compressed to the right"
                height={200}
                yMin={fitYMin(curve.data.points, curve.data.desiredRetention)}
                xScale="sqrt"
                summary={`Forgetting curve for this card across ${curve.data.markers.length} reviews.`}
              />
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this card?"
        description="The card and its review history are removed for good. To stop seeing it but keep the history, suspend it instead."
        confirmLabel="Delete card"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(card.id, {
            onSuccess: () => {
              toast.success('Card deleted.');
              setConfirmDelete(false);
              onDone();
            },
            onError: (error) => toast.error(messageOf(error)),
          })
        }
      />
    </div>
  );
}

function Fact({ term, value, note }: { term: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-caption text-ink-muted">{term}</dt>
      <dd className="tabular mt-0.5 text-body text-ink">{value}</dd>
      {note ? <dd className="text-[11px] leading-4 text-ink-faint">{note}</dd> : null}
    </div>
  );
}
