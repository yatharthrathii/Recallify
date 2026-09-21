'use client';

import {
  ApiError,
  acknowledge,
  enqueue,
  nextBatch,
  parseOutbox,
  type PendingReview,
} from '@recallify/core';
import { useApi } from '@recallify/core/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'recallify-outbox';

function read(): PendingReview[] {
  try {
    return parseOutbox(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function write(entries: PendingReview[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage is unavailable (private window, blocked site data). The review
    // is still sent straight away; it just cannot be kept across a reload.
  }
}

/**
 * Answers are written down before they are sent.
 *
 * Every rating goes into the outbox first and leaves it only when the server
 * has accepted it. A dropped connection, a closed laptop or a reload in the
 * middle of a session loses nothing: whatever is still here is sent again on
 * the next visit. Sending twice is safe because each review carries the id it
 * was created with, and that id is its primary key on the server.
 */
export function useReviewOutbox() {
  const api = useApi();
  const [pending, setPending] = useState(0);
  const flushing = useRef(false);

  const flush = useCallback(async (): Promise<void> => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (;;) {
        const batch = nextBatch(read());
        if (batch.length === 0) break;

        try {
          await api.review.batch({
            reviews: batch.map((e) => ({ ...e, reviewedAt: new Date(e.reviewedAt) })),
          });
          write(
            acknowledge(
              read(),
              batch.map((e) => e.id),
            ),
          );
        } catch (error) {
          // One review for a card that has since been deleted fails the whole
          // batch with a 404. Send them one at a time and let go of the ones
          // that can never land, or the outbox would be stuck behind them.
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
          for (const entry of batch) {
            try {
              await api.review.submit({
                ...entry,
                reviewedAt: new Date(entry.reviewedAt),
              });
            } catch (inner) {
              if (!(inner instanceof ApiError) || inner.status !== 404) throw inner;
            }
            write(acknowledge(read(), [entry.id]));
          }
        }
      }
    } catch {
      // Still offline, or the server is down. Everything stays in the outbox.
    } finally {
      flushing.current = false;
      setPending(read().length);
    }
  }, [api]);

  const record = useCallback(
    (entry: PendingReview): void => {
      write(enqueue(read(), entry));
      setPending(read().length);
      void flush();
    },
    [flush],
  );

  useEffect(() => {
    void flush();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(() => void flush(), 20_000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }, [flush]);

  return { record, pending, flush };
}
