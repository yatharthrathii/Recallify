import type { QueueCard, SchedulingConfig } from '@recallify/contracts';
import { DEFAULT_CONFIG, DEFAULT_PARAMS } from '@recallify/fsrs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, NetworkError, Transport, type HttpResponse } from '../src/api/http';
import {
  describeInterval,
  estimateMinutes,
  formatCount,
  formatDue,
  formatInterval,
  formatPercent,
} from '../src/format';
import { acknowledge, enqueue, parseOutbox, type PendingReview } from '../src/outbox';
import {
  currentCard,
  previewIntervals,
  progress,
  rate,
  reveal,
  startSession,
  toFsrsConfig,
} from '../src/session';

const NOW = new Date('2026-09-21T10:00:00.000Z');
const DAY = 86_400_000;

const schedulingConfig: SchedulingConfig = {
  params: [...DEFAULT_PARAMS],
  desiredRetention: 0.9,
  maximumInterval: DEFAULT_CONFIG.maximumInterval,
  learningSteps: [...DEFAULT_CONFIG.learningSteps],
  relearningSteps: [...DEFAULT_CONFIG.relearningSteps],
};
const config = toFsrsConfig(schedulingConfig);

function newCard(id: string): QueueCard {
  return {
    id,
    deckId: 'deck',
    deckTitle: 'Deck',
    front: `front ${id}`,
    back: `back ${id}`,
    hint: null,
    retrievability: 0,
    state: 'NEW',
    stability: 0,
    difficulty: 0,
    dueAt: NOW,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    learningStep: 0,
  };
}

function matureCard(id: string): QueueCard {
  return {
    ...newCard(id),
    state: 'REVIEW',
    stability: 40,
    difficulty: 5,
    reps: 6,
    retrievability: 0.9,
    lastReviewedAt: new Date(NOW.getTime() - 40 * DAY),
  };
}

describe('format', () => {
  it('writes intervals as short as they can honestly be', () => {
    expect(formatInterval(0)).toBe('now');
    expect(formatInterval(1 / 1440)).toBe('1m');
    expect(formatInterval(10 / 1440)).toBe('10m');
    expect(formatInterval(3 / 24)).toBe('3h');
    expect(formatInterval(4)).toBe('4d');
    expect(formatInterval(63)).toBe('2.1mo');
    expect(formatInterval(60)).toBe('2mo');
    expect(formatInterval(511)).toBe('1.4y');
  });

  it('writes the same intervals in words', () => {
    expect(describeInterval(1)).toBe('1 day');
    expect(describeInterval(4)).toBe('4 days');
    expect(describeInterval(1 / 24)).toBe('1 hour');
  });

  it('says whether a card is due, coming, or late', () => {
    expect(formatDue(NOW, NOW)).toBe('due now');
    expect(formatDue(new Date(NOW.getTime() + 3 * 3_600_000), NOW)).toBe('in 3h');
    expect(formatDue(new Date(NOW.getTime() - 2 * DAY), NOW)).toBe('2d overdue');
  });

  it('keeps percentages inside 0 to 100', () => {
    expect(formatPercent(0.874)).toBe('87%');
    expect(formatPercent(1.4)).toBe('100%');
    expect(formatPercent(Number.NaN)).toBe('0%');
  });

  it('groups thousands and never estimates zero minutes', () => {
    expect(formatCount(1204)).toBe('1,204');
    expect(estimateMinutes(1)).toBe(1);
    expect(estimateMinutes(90)).toBe(12);
  });
});

describe('review session', () => {
  it('starts on the first card, answer hidden', () => {
    const state = startSession([newCard('a'), newCard('b')]);
    expect(currentCard(state)?.id).toBe('a');
    expect(state.revealed).toBe(false);
    expect(reveal(state).revealed).toBe(true);
  });

  it('brings a learning card back in the same session', () => {
    const state = startSession([newCard('a'), newCard('b')]);
    const result = rate(state, 3, NOW, config);

    // Good on a new card lands on a learning step minutes away, so the card
    // goes to the back of the queue rather than disappearing until tomorrow.
    expect(result?.requeued).toBe(true);
    expect(result?.state.queue.map((c) => c.id)).toEqual(['b', 'a']);
    expect(result?.state.queue[1]?.state).toBe('LEARNING');
    expect(result?.state.revealed).toBe(false);
  });

  it('lets a mature card leave the session', () => {
    const state = startSession([matureCard('a'), newCard('b')]);
    const result = rate(state, 3, NOW, config);

    expect(result?.requeued).toBe(false);
    expect(result?.state.queue.map((c) => c.id)).toEqual(['b']);
    expect(result?.intervalDays).toBeGreaterThan(40);
  });

  it('tallies each rating and reports what to send', () => {
    let state = startSession([matureCard('a'), matureCard('b')]);
    const first = rate(state, 1, NOW, config);
    expect(first?.submission).toEqual({ cardId: 'a', rating: 1, reviewedAt: NOW });
    state = first!.state;

    expect(state.tally).toMatchObject({ reviewed: 1, again: 1, good: 0 });
  });

  it('orders the four buttons the way their names promise', () => {
    const preview = previewIntervals(matureCard('a'), NOW, config);
    expect(preview.again).toBeLessThan(preview.hard);
    expect(preview.hard).toBeLessThan(preview.good);
    expect(preview.good).toBeLessThan(preview.easy);
  });

  it('measures progress in distinct cards, so a requeue is not a step backwards', () => {
    const state = startSession([newCard('a'), matureCard('b')]);
    expect(progress(state)).toBe(0);

    const afterA = rate(state, 3, NOW, config)!.state; // a requeued
    expect(progress(afterA)).toBe(0);

    const afterB = rate(afterA, 3, NOW, config)!.state; // b leaves
    expect(progress(afterB)).toBe(0.5);
  });

  it('returns null when there is nothing left to rate', () => {
    expect(rate(startSession([]), 3, NOW, config)).toBeNull();
    expect(progress(startSession([]))).toBe(1);
  });
});

describe('outbox', () => {
  const entry: PendingReview = {
    id: '3f1a6b2c-9d4e-4f7a-8b1c-2e5d7a9c0f31',
    cardId: 'card',
    rating: 3,
    reviewedAt: NOW.toISOString(),
  };

  it('never holds the same review twice', () => {
    expect(enqueue(enqueue([], entry), entry)).toHaveLength(1);
  });

  it('drops what the server accepted', () => {
    expect(acknowledge([entry], [entry.id])).toHaveLength(0);
    expect(acknowledge([entry], ['something-else'])).toHaveLength(1);
  });

  it('survives storage that has been corrupted', () => {
    expect(parseOutbox('not json')).toEqual([]);
    expect(parseOutbox('{"an":"object"}')).toEqual([]);
    expect(parseOutbox(JSON.stringify([entry, { id: 1 }, null]))).toEqual([entry]);
    expect(parseOutbox(null)).toEqual([]);
  });
});

describe('transport', () => {
  const reply = (status: number, body: unknown): HttpResponse => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });

  it('parses the reply through the schema, turning strings into dates', async () => {
    const transport = new Transport({
      baseUrl: '/api/v1',
      fetch: async () => reply(200, { at: '2026-09-21T10:00:00.000Z' }),
    });
    const schema = z.object({ at: z.string().transform((v) => new Date(v)) });
    const out = await transport.request('/x', { schema });
    expect(out.at).toBeInstanceOf(Date);
  });

  it('turns a problem document into an ApiError with field messages', async () => {
    const transport = new Transport({
      baseUrl: '',
      fetch: async () =>
        reply(400, {
          title: 'Invalid request',
          detail: 'Some fields are missing or malformed.',
          traceId: 'abc',
          errors: { email: ['Invalid email'] },
        }),
    });
    const error = await transport.request('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors).toEqual({ email: ['Invalid email'] });
    expect((error as ApiError).traceId).toBe('abc');
  });

  it('reports a dropped connection as a NetworkError, not a crash', async () => {
    const transport = new Transport({
      baseUrl: '',
      fetch: async () => {
        throw new TypeError('failed to fetch');
      },
    });
    await expect(transport.request('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('refreshes once, however many requests hit a 401 together', async () => {
    let refreshes = 0;
    let sessionValid = false;
    const transport = new Transport({
      baseUrl: '',
      fetch: async () => (sessionValid ? reply(200, { ok: true }) : reply(401, { title: 'Unauthorized' })),
      refresh: async () => {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 20));
        sessionValid = true;
        return true;
      },
    });

    const schema = z.object({ ok: z.boolean() });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => transport.request('/x', { schema })),
    );

    // Refresh tokens rotate; eight parallel refreshes would revoke the session.
    expect(refreshes).toBe(1);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('gives up with the 401 when the session cannot be refreshed', async () => {
    const transport = new Transport({
      baseUrl: '',
      fetch: async () => reply(401, { title: 'Unauthorized' }),
      refresh: async () => false,
    });
    const error = await transport.request('/x').catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(401);
  });
});
