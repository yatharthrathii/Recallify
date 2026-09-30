'use client';

import type { DeckColor } from '@recallify/contracts';
import { ApiError, formatCount } from '@recallify/core';
import { useImportCards } from '@recallify/core/react';
import {
  ImportError,
  chunkDeck,
  parseApkg,
  parseCsv,
  type ImportDeck,
  type ImportPreview,
} from '@recallify/import';
import { ArrowRight, FileUp } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { FillBar, Stagger, StaggerItem } from '@/components/motion';
import { PageShell, Section } from '@/components/shell/app-shell';
import { Button, LinkButton, Spinner } from '@/components/ui/button';
import { EmptyState, messageOf } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { loadSqlJs } from '@/lib/sqljs';

const ACCEPT = '.apkg,.csv,.tsv,.txt';
const COLORS: readonly DeckColor[] = ['teal', 'amber', 'clay', 'moss', 'slate', 'sand'];

type Phase =
  | { kind: 'pick'; error?: string }
  | { kind: 'reading'; name: string }
  | { kind: 'preview'; preview: ImportPreview; fileName: string }
  | { kind: 'importing' }
  | { kind: 'done' };

interface DeckProgress {
  name: string;
  cards: number;
  reviews: number;
  sent: number;
  deckId: string | null;
  state: 'waiting' | 'sending' | 'done' | 'skipped' | 'failed';
  message?: string | undefined;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'Imported';
}

async function readFile(file: File): Promise<ImportPreview> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.apkg')) {
    const [sql, buffer] = await Promise.all([loadSqlJs(), file.arrayBuffer()]);
    return parseApkg(new Uint8Array(buffer), sql);
  }
  if (/\.(csv|tsv|txt)$/.test(name)) {
    return parseCsv(await file.text(), { deckName: baseName(file.name) });
  }
  throw new ImportError('Choose a .apkg export, or a .csv or .txt file with a question and an answer per line.');
}

/**
 * Bring cards in from a file, with their history.
 *
 * The file never leaves the device: it is read here, in the browser, and only
 * the cards and their reviews are sent, in requests small enough for a
 * serverless API. The preview is what will be sent, deck by deck, with what
 * could not be carried across said plainly above the button.
 */
export function ImportView() {
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [names, setNames] = useState<Record<number, string>>({});
  const [progress, setProgress] = useState<DeckProgress[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const previewRef = useRef<ImportPreview | null>(null);
  const importCards = useImportCards();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPhase({ kind: 'reading', name: file.name });
    try {
      const preview = await readFile(file);
      if (preview.cardCount === 0) {
        setPhase({
          kind: 'pick',
          error:
            preview.notes.map((n) => n.message).join(' ') ||
            'No cards were found in that file.',
        });
        return;
      }
      previewRef.current = preview;
      setSelected(new Set(preview.decks.map((_, i) => i)));
      setNames({});
      setPhase({ kind: 'preview', preview, fileName: file.name });
    } catch (error) {
      setPhase({
        kind: 'pick',
        error:
          error instanceof ImportError || error instanceof Error
            ? error.message
            : 'That file could not be read.',
      });
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void pick(event.dataTransfer.files[0]);
  };

  const nameOf = (deck: ImportDeck, index: number) => (names[index] ?? deck.name).trim() || deck.name;

  /** Sends every selected deck, chunk by chunk, continuing past a deck already imported. */
  const run = async (resume = false) => {
    const preview = previewRef.current;
    if (!preview) return;
    const decks = preview.decks
      .map((deck, index) => ({ deck, index }))
      .filter(({ index }) => selected.has(index));

    let rows: DeckProgress[] = resume
      ? progress
      : decks.map(({ deck, index }) => ({
          name: nameOf(deck, index),
          cards: deck.cards.length,
          reviews: deck.reviewCount,
          sent: 0,
          deckId: null,
          state: 'waiting',
        }));
    const update = (i: number, patch: Partial<DeckProgress>) => {
      rows = rows.map((row, j) => (j === i ? { ...row, ...patch } : row));
      setProgress(rows);
    };
    setProgress(rows);
    setPhase({ kind: 'importing' });

    for (let i = 0; i < decks.length; i += 1) {
      const row = rows[i]!;
      if (row.state === 'done' || row.state === 'skipped') continue;
      const { deck, index } = decks[i]!;
      update(i, { state: 'sending', message: undefined });

      const chunks = chunkDeck(deck);
      let deckId = row.deckId;
      let sent = row.sent;
      // A resumed deck starts again at the first chunk it did not finish.
      let from = 0;
      let counted = 0;
      while (from < chunks.length && counted + chunks[from]!.cards.length <= sent) {
        counted += chunks[from]!.cards.length;
        from += 1;
      }

      try {
        for (let c = from; c < chunks.length; c += 1) {
          const chunk = chunks[c]!;
          const result = await importCards.mutateAsync({
            ...(deckId
              ? { deckId }
              : { newDeck: { title: nameOf(deck, index), color: COLORS[index % COLORS.length]! } }),
            cards: chunk.cards.map((card) => ({
              front: card.front,
              back: card.back,
              ...(card.hint ? { hint: card.hint } : {}),
              suspended: card.suspended,
              reviews: card.reviews.map((r) => ({
                id: r.id,
                rating: r.rating,
                reviewedAt: new Date(r.reviewedAt).toISOString(),
                ...(r.durationMs ? { durationMs: r.durationMs } : {}),
              })),
            })),
          });
          deckId = result.deckId;
          sent += chunk.cards.length;
          update(i, { deckId, sent });
        }
        update(i, { state: 'done' });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409 && sent === 0) {
          update(i, { state: 'skipped', message: 'Already imported. Nothing was added twice.' });
          continue;
        }
        update(i, { state: 'failed', message: messageOf(error) });
        return;
      }
    }
    setPhase({ kind: 'done' });
  };

  const totals = progress.reduce(
    (t, row) => ({
      cards: t.cards + (row.state === 'done' ? row.cards : row.sent),
      reviews: t.reviews + (row.state === 'done' ? row.reviews : 0),
      decks: t.decks + (row.state === 'done' ? 1 : 0),
    }),
    { cards: 0, reviews: 0, decks: 0 },
  );
  const failed = progress.find((row) => row.state === 'failed');

  return (
    <PageShell
      title="Import"
      description="Bring cards in from another app or a spreadsheet. The file is read here on your device, and every review you gave a card comes with it, so its schedule picks up where it left off."
      width="prose"
    >
      {phase.kind === 'pick' || phase.kind === 'reading' ? (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a file to import"
            onClick={() => input.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors duration-200',
              dragging ? 'border-accent bg-highlight/40' : 'border-line-strong hover:border-ink',
              phase.kind === 'reading' && 'pointer-events-none',
            )}
          >
            {phase.kind === 'reading' ? (
              <>
                <Spinner className="size-5 text-ink" />
                <p className="text-ui text-ink">Reading {phase.name} on this device</p>
                <p className="text-caption text-ink-muted">Nothing has been uploaded yet.</p>
              </>
            ) : (
              <>
                <FileUp className="size-6 text-ink-muted" />
                <p className="text-body font-medium text-ink">Drop a file here, or choose one</p>
                <p className="text-caption text-ink-muted">
                  A .apkg deck export, or a .csv with a question and an answer per line
                </p>
              </>
            )}
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="File to import"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {phase.kind === 'pick' && phase.error ? (
            <p role="alert" className="mt-3 text-ui text-danger">
              {phase.error}
            </p>
          ) : null}

          <Section title="What comes across" className="mt-12">
            <dl className="grid gap-x-8 gap-y-4 text-ui sm:grid-cols-2">
              <div>
                <dt className="font-medium text-ink">Kept</dt>
                <dd className="mt-1 text-ink-muted">
                  The text of every card, hints, which cards were suspended, and each
                  card&rsquo;s whole review history: every answer, with when it was given.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Left behind</dt>
                <dd className="mt-1 text-ink-muted">
                  Images, audio and formatting. The other app&rsquo;s scheduling numbers,
                  on purpose: your reviews are replayed through this scheduler instead, so
                  every card arrives with a stability this engine computed.
                </dd>
              </div>
            </dl>
          </Section>
        </>
      ) : null}

      {phase.kind === 'preview' ? (
        <PreviewStep
          preview={phase.preview}
          fileName={phase.fileName}
          selected={selected}
          onToggle={(i) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(i)) next.delete(i);
              else next.add(i);
              return next;
            })
          }
          names={names}
          onRename={(i, name) => setNames((prev) => ({ ...prev, [i]: name }))}
          onBack={() => setPhase({ kind: 'pick' })}
          onImport={() => void run()}
        />
      ) : null}

      {phase.kind === 'importing' || phase.kind === 'done' ? (
        <div>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {progress.map((row, i) => (
              <li key={i} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-ui font-medium text-ink">{row.name}</span>
                  <span className="tabular shrink-0 text-caption text-ink-muted">
                    {row.state === 'done'
                      ? `${formatCount(row.cards)} cards, ${formatCount(row.reviews)} reviews`
                      : row.state === 'sending'
                        ? `${formatCount(row.sent)} of ${formatCount(row.cards)} cards`
                        : row.state === 'skipped'
                          ? 'skipped'
                          : row.state === 'failed'
                            ? 'stopped'
                            : 'waiting'}
                  </span>
                </div>
                <FillBar
                  className="mt-2"
                  ratio={row.state === 'done' || row.state === 'skipped' ? 1 : row.sent / Math.max(1, row.cards)}
                />
                {row.message ? (
                  <p
                    role={row.state === 'failed' ? 'alert' : undefined}
                    className={cn('mt-2 text-caption', row.state === 'failed' ? 'text-danger' : 'text-ink-muted')}
                  >
                    {row.message}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {phase.kind === 'done' ? (
            <div className="mt-8">
              <p className="text-body text-ink">
                Imported <span className="tabular font-medium">{formatCount(totals.cards)}</span>{' '}
                cards and <span className="tabular font-medium">{formatCount(totals.reviews)}</span>{' '}
                reviews into {totals.decks} {totals.decks === 1 ? 'deck' : 'decks'}.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <LinkButton href="/decks" variant="primary">
                  Open decks
                  <ArrowRight className="size-4" />
                </LinkButton>
                {totals.reviews > 0 ? (
                  <LinkButton href="/stats/report">See what your history says</LinkButton>
                ) : null}
                <Button variant="ghost" onClick={() => setPhase({ kind: 'pick' })}>
                  Import another file
                </Button>
              </div>
            </div>
          ) : failed ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void run(true)}>
                Try again from where it stopped
              </Button>
              <Button variant="ghost" onClick={() => setPhase({ kind: 'pick' })}>
                Start over
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-caption text-ink-muted">
              Keep this page open. Each deck is sent in parts, and a part that fails can be resent.
            </p>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}

function PreviewStep({
  preview,
  fileName,
  selected,
  onToggle,
  names,
  onRename,
  onBack,
  onImport,
}: {
  preview: ImportPreview;
  fileName: string;
  selected: Set<number>;
  onToggle: (index: number) => void;
  names: Record<number, string>;
  onRename: (index: number, name: string) => void;
  onBack: () => void;
  onImport: () => void;
}) {
  const chosen = preview.decks.filter((_, i) => selected.has(i));
  const cards = chosen.reduce((n, d) => n + d.cards.length, 0);
  const reviews = chosen.reduce((n, d) => n + d.reviewCount, 0);

  return (
    <div>
      <p className="text-ui text-ink-muted">
        <span className="text-ink">{fileName}</span>: {preview.decks.length}{' '}
        {preview.decks.length === 1 ? 'deck' : 'decks'},{' '}
        <span className="tabular text-ink">{formatCount(preview.cardCount)}</span> cards,{' '}
        <span className="tabular text-ink">{formatCount(preview.reviewCount)}</span> reviews.
        {preview.format === 'csv' ? ' A text file carries no history, so every card arrives new.' : ''}
      </p>

      <Stagger as="ul" gap={0.05} delay={0.1} className="mt-5 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {preview.decks.map((deck, i) => {
          const fresh = deck.cards.filter((c) => c.reviews.length === 0).length;
          return (
            <StaggerItem as="li" key={i} className="flex items-start gap-3 px-4 py-3 sm:items-center">
              <input
                type="checkbox"
                aria-label={`Import ${deck.name}`}
                checked={selected.has(i)}
                onChange={() => onToggle(i)}
                className="mt-2.5 size-4 shrink-0 accent-[var(--accent)] sm:mt-0"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <input
                  type="text"
                  aria-label={`Deck name for ${deck.name}`}
                  value={names[i] ?? deck.name}
                  onChange={(e) => onRename(i, e.target.value)}
                  maxLength={120}
                  className="h-9 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-ui text-ink transition-colors hover:border-line-strong focus-visible:border-accent focus-visible:outline-none"
                />
                <span className="tabular px-2 text-caption text-ink-muted sm:text-right">
                  {formatCount(deck.cards.length)} cards
                  {fresh > 0 && fresh < deck.cards.length ? `, ${formatCount(fresh)} new` : ''}
                  {deck.reviewCount > 0 ? `, ${formatCount(deck.reviewCount)} reviews` : ''}
                </span>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>

      {preview.notes.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-1.5 text-caption text-ink-muted">
          {preview.notes.map((note) => (
            <li key={note.code} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-faint" />
              {note.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Choose another file
        </Button>
        <Button variant="primary" disabled={chosen.length === 0} onClick={onImport}>
          Import {formatCount(cards)} cards
          {reviews > 0 ? ` and ${formatCount(reviews)} reviews` : ''}
        </Button>
      </div>

      {chosen.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Nothing selected"
          body="Tick at least one deck to import it."
        />
      ) : null}
    </div>
  );
}
