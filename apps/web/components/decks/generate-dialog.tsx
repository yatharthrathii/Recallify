'use client';

import type { GeneratedCard } from '@recallify/contracts';
import { MAX_NOTES_CHARS } from '@recallify/contracts';
import { ApiError } from '@recallify/core';
import {
  useAiUsage,
  useApi,
  useBulkCreateCards,
  useGenerateCards,
} from '@recallify/core/react';
import { Flag, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, IconButton } from '@/components/ui/button';
import { Segmented, Tooltip } from '@/components/ui/controls';
import { Dialog } from '@/components/ui/dialog';
import { TextArea, TextField, fieldError } from '@/components/ui/field';
import { messageOf } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
}

export function GenerateDialog({ open, onOpenChange, deckId }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Generate cards"
      description="Drafts are written by a language model. Read them before saving: models state wrong facts with full confidence."
      size="lg"
    >
      {open ? <Generate deckId={deckId} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

interface Draft extends GeneratedCard {
  key: number;
  keep: boolean;
}

function Generate({ deckId, onDone }: { deckId: string; onDone: () => void }) {
  const api = useApi();
  const usage = useAiUsage();
  const generate = useGenerateCards();
  const save = useBulkCreateCards();

  const [mode, setMode] = useState<'topic' | 'notes'>('topic');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [count, setCount] = useState(10);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [model, setModel] = useState<string | undefined>();

  const remaining = usage.data?.remaining;
  const errors =
    generate.error instanceof ApiError ? generate.error.fieldErrors : undefined;
  const ready = mode === 'topic' ? topic.trim().length >= 3 : notes.trim().length >= 50;
  const kept = drafts?.filter((d) => d.keep) ?? [];

  const run = (event: React.FormEvent) => {
    event.preventDefault();
    generate.mutate(
      {
        deckId,
        count,
        ...(mode === 'topic' ? { topic: topic.trim() } : { text: notes.trim() }),
      },
      {
        onSuccess: (result) => {
          setModel(result.model);
          setDrafts(result.drafts.map((d, i) => ({ ...d, key: i, keep: true })));
          if (result.drafts.length < count) {
            toast.message(
              `${result.drafts.length} drafts came back, and that is what was charged.`,
            );
          }
        },
        onError: (error) => toast.error(messageOf(error)),
      },
    );
  };

  const report = (draft: Draft) => {
    api.ai
      .report({
        front: draft.front,
        back: draft.back,
        reason: 'incorrect',
        ...(model ? { model } : {}),
      })
      .then(() => toast.success('Reported. The draft was removed.'))
      .catch((error: unknown) => toast.error(messageOf(error)));
    setDrafts((list) => list?.filter((d) => d.key !== draft.key) ?? null);
  };

  if (drafts) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-ui text-ink-muted">
            <span className="tabular text-ink">{kept.length}</span> of{' '}
            <span className="tabular text-ink">{drafts.length}</span> selected. Nothing is
            saved yet.
          </p>
          <button
            type="button"
            className="text-ui text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            onClick={() =>
              setDrafts(
                (list) => list?.map((d) => ({ ...d, keep: kept.length === 0 })) ?? null,
              )
            }
          >
            {kept.length === 0 ? 'Select all' : 'Select none'}
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {drafts.map((draft, i) => (
              <motion.li
                key={draft.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: -8 }}
                transition={{ duration: 0.16, delay: Math.min(0.2, i * 0.02) }}
                className={cn(
                  'flex gap-3 overflow-hidden rounded-md border px-3 py-3 transition-colors duration-90',
                  draft.keep
                    ? 'border-line-strong bg-surface'
                    : 'border-line bg-surface-alt/50',
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`Keep draft ${i + 1}`}
                  checked={draft.keep}
                  onChange={(e) =>
                    setDrafts(
                      (list) =>
                        list?.map((d) =>
                          d.key === draft.key ? { ...d, keep: e.target.checked } : d,
                        ) ?? null,
                    )
                  }
                  className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                />
                <div className={cn('min-w-0 flex-1', !draft.keep && 'opacity-55')}>
                  <p className="text-ui font-medium text-ink">{draft.front}</p>
                  <p className="mt-1 text-ui text-ink-muted">{draft.back}</p>
                  {draft.hint ? (
                    <p className="mt-1 text-caption text-ink-faint">Hint: {draft.hint}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col">
                  <Tooltip label="Report as wrong and remove">
                    <IconButton
                      label="Report as wrong and remove"
                      onClick={() => report(draft)}
                      className="size-8"
                    >
                      <Flag className="size-3.5" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label="Remove">
                    <IconButton
                      label="Remove draft"
                      className="size-8"
                      onClick={() =>
                        setDrafts(
                          (list) => list?.filter((d) => d.key !== draft.key) ?? null,
                        )
                      }
                    >
                      <X className="size-3.5" />
                    </IconButton>
                  </Tooltip>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setDrafts(null)}>
            Back
          </Button>
          <Button
            variant="primary"
            disabled={kept.length === 0}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  deckId,
                  source: 'AI',
                  cards: kept.map(({ front, back, hint }) => ({
                    front,
                    back,
                    ...(hint ? { hint } : {}),
                  })),
                },
                {
                  onSuccess: (result) => {
                    toast.success(`${result.created} cards saved. They are due now.`);
                    onDone();
                  },
                  onError: (error) => toast.error(messageOf(error)),
                },
              )
            }
          >
            Save {kept.length} {kept.length === 1 ? 'card' : 'cards'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={run} className="flex flex-col gap-5">
      <Segmented
        label="Source"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'topic', label: 'From a topic' },
          { value: 'notes', label: 'From my notes' },
        ]}
        className="self-start"
      />

      {mode === 'topic' ? (
        <TextField
          label="Topic"
          hint="Be specific. The Krebs cycle gives better cards than Biology."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          autoFocus
          placeholder="Fundamental Rights in the Indian Constitution"
          error={fieldError(errors, 'topic')}
        />
      ) : (
        <TextArea
          label="Notes"
          hint="Cards are made only from facts stated in the notes."
          aside={
            <span className="tabular">
              {notes.length.toLocaleString('en-US')} /{' '}
              {MAX_NOTES_CHARS.toLocaleString('en-US')}
            </span>
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={MAX_NOTES_CHARS}
          rows={8}
          autoFocus
          error={fieldError(errors, 'text')}
        />
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-ui font-medium text-ink">How many</span>
          <span className="text-caption text-ink-muted">
            {remaining === undefined ? (
              'Checking allowance'
            ) : (
              <>
                <span className="tabular text-ink">{remaining}</span> of{' '}
                <span className="tabular">{usage.data?.dailyLimit}</span> left today
              </>
            )}
          </span>
        </div>
        <Segmented
          label="How many cards"
          value={String(count)}
          onChange={(v) => setCount(Number(v))}
          options={[5, 10, 15, 20].map((n) => ({ value: String(n), label: String(n) }))}
          className="w-full sm:w-auto"
        />
        {remaining !== undefined && remaining < count && remaining > 0 ? (
          <p className="mt-2 text-caption text-ink-muted">
            Only {remaining} left, so {remaining} will be drafted.
          </p>
        ) : null}
        {remaining === 0 ? (
          <p className="mt-2 text-caption text-danger">
            The allowance for today is used up. It resets at midnight UTC.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!ready || remaining === 0}
          loading={generate.isPending}
        >
          {generate.isPending ? 'Drafting' : 'Draft cards'}
        </Button>
      </div>
    </form>
  );
}
