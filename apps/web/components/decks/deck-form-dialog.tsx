'use client';

import type { Deck, DeckColor } from '@recallify/contracts';
import { ApiError } from '@recallify/core';
import { useCreateDeck, useUpdateDeck } from '@recallify/core/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextArea, TextField, fieldError } from '@/components/ui/field';
import { messageOf } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

const COLORS: readonly DeckColor[] = ['amber', 'teal', 'clay', 'moss', 'slate', 'sand'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  deck?: Deck;
  onCreated?: (deck: Deck) => void;
}

export function DeckFormDialog({ open, onOpenChange, deck, onCreated }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={deck ? 'Edit deck' : 'New deck'}
      size="sm"
    >
      {/* Mounted with the dialog, so every opening starts from fresh state. */}
      {open ? (
        <DeckForm deck={deck} onDone={() => onOpenChange(false)} onCreated={onCreated} />
      ) : null}
    </Dialog>
  );
}

function DeckForm({
  deck,
  onDone,
  onCreated,
}: {
  deck: Deck | undefined;
  onDone: () => void;
  onCreated: ((deck: Deck) => void) | undefined;
}) {
  const [title, setTitle] = useState(deck?.title ?? '');
  const [description, setDescription] = useState(deck?.description ?? '');
  const [color, setColor] = useState<DeckColor>(deck?.color ?? 'amber');

  const create = useCreateDeck();
  const update = useUpdateDeck(deck?.id ?? '');
  const mutation = deck ? update : create;
  const errors =
    mutation.error instanceof ApiError ? mutation.error.fieldErrors : undefined;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const base = { title: title.trim(), color };
    const text = description.trim();

    if (deck) {
      update.mutate(
        { ...base, description: text },
        {
          onSuccess: () => {
            toast.success('Deck updated.');
            onDone();
          },
          onError: (error) => toast.error(messageOf(error)),
        },
      );
    } else {
      create.mutate(text ? { ...base, description: text } : base, {
        onSuccess: (created) => {
          toast.success('Deck created.');
          onDone();
          onCreated?.(created);
        },
        onError: (error) => toast.error(messageOf(error)),
      });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        required
        autoFocus
        placeholder="Human anatomy"
        error={fieldError(errors, 'title')}
      />
      <TextArea
        label="Description"
        aside="Optional"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
        rows={3}
        error={fieldError(errors, 'description')}
      />

      <fieldset>
        <legend className="mb-2 text-ui font-medium text-ink">Label colour</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn(
                'size-9 rounded-md border-2 transition-transform duration-90 active:scale-95',
                color === c
                  ? 'border-ink'
                  : 'border-transparent hover:border-line-strong',
              )}
            >
              <span
                className="block size-full rounded-[5px] border border-ink/10"
                style={{ background: `var(--deck-${c})` }}
              />
            </button>
          ))}
        </div>
        <p className="mt-2 text-caption text-ink-muted">
          Only a label. It says nothing about how well the deck is remembered.
        </p>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={mutation.isPending}
          disabled={!title.trim()}
        >
          {deck ? 'Save changes' : 'Create deck'}
        </Button>
      </div>
    </form>
  );
}
