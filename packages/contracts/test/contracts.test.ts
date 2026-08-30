/**
 * Contract tests.
 *
 * These schemas are the only definition of every request and response in the
 * system — they produce runtime validation, TypeScript types for all three
 * clients, and the OpenAPI document. A hole here is a hole everywhere, so the
 * tests cover what the schemas are supposed to *prevent*, not that Zod works.
 */

import { describe, expect, it } from 'vitest';
import { generateRequest } from '../src/ai';
import { loginRequest, password, registerRequest, updateSettingsRequest } from '../src/auth';
import { bulkCreateRequest, createCardRequest } from '../src/card';
import { pageQuery, paginated, problemDetails } from '../src/common';
import { createDeckRequest, updateDeckRequest } from '../src/deck';
import { batchReviewRequest, queueQuery, submitReviewRequest } from '../src/review';
import { z } from 'zod';

const CUID = 'clh3k2j9a0000qwer1234abcd';
const UUID = '3f1a6b2c-9d4e-4f7a-8b1c-2e5d7a9c0f31';

describe('auth', () => {
  it('normalises email so the same person cannot register twice', () => {
    const parsed = registerRequest.parse({
      email: '  Yatharth@Example.COM ',
      password: 'a-long-enough-password',
    });
    expect(parsed.email).toBe('yatharth@example.com');
  });

  it('rejects an address that is not one', () => {
    expect(() => loginRequest.parse({ email: 'not-an-email', password: 'longenough1' })).toThrow();
  });

  it('asks for length rather than punctuation', () => {
    // Composition rules produce "Password1!" and stop there. Length is what
    // actually costs an attacker.
    expect(password.safeParse('short').success).toBe(false);
    expect(password.safeParse('correct horse battery').success).toBe(true);
  });

  it('stays under the 72-byte hashing ceiling', () => {
    expect(password.safeParse('x'.repeat(72)).success).toBe(true);
    expect(password.safeParse('x'.repeat(73)).success).toBe(false);
  });

  it('keeps desired retention inside a range the engine can serve', () => {
    expect(updateSettingsRequest.safeParse({ desiredRetention: 0.9 }).success).toBe(true);
    // Below 0.7 the intervals get absurd; at 1.0 the interval is zero.
    expect(updateSettingsRequest.safeParse({ desiredRetention: 0.5 }).success).toBe(false);
    expect(updateSettingsRequest.safeParse({ desiredRetention: 1 }).success).toBe(false);
  });

  it('allows changing one setting without sending the rest', () => {
    expect(updateSettingsRequest.safeParse({ dailyNewLimit: 30 }).success).toBe(true);
    expect(updateSettingsRequest.safeParse({}).success).toBe(true);
  });
});

describe('decks', () => {
  it('defaults the accent colour so the client never has to', () => {
    expect(createDeckRequest.parse({ title: 'Spanish' }).color).toBe('amber');
  });

  it('refuses a colour outside the deck palette', () => {
    // The memory scale is reserved for retrievability; a deck may not borrow it.
    expect(createDeckRequest.safeParse({ title: 'x', color: 'lost' }).success).toBe(false);
    expect(createDeckRequest.safeParse({ title: 'x', color: 'teal' }).success).toBe(true);
  });

  it('refuses an empty or whitespace-only title', () => {
    expect(createDeckRequest.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('allows archiving through the update contract', () => {
    expect(updateDeckRequest.safeParse({ archived: true }).success).toBe(true);
  });
});

describe('cards', () => {
  it('trims and requires content on both sides', () => {
    const parsed = createCardRequest.parse({
      deckId: CUID,
      front: '  What is stability?  ',
      back: 'Days until recall falls to 90%',
    });
    expect(parsed.front).toBe('What is stability?');

    expect(
      createCardRequest.safeParse({ deckId: CUID, front: '  ', back: 'x' }).success,
    ).toBe(false);
  });

  it('caps a bulk insert so one request cannot hold a table', () => {
    const many = (n: number) => ({
      deckId: CUID,
      cards: Array.from({ length: n }, (_, i) => ({ front: `q${i}`, back: `a${i}` })),
    });
    expect(bulkCreateRequest.safeParse(many(500)).success).toBe(true);
    expect(bulkCreateRequest.safeParse(many(501)).success).toBe(false);
    expect(bulkCreateRequest.safeParse(many(0)).success).toBe(false);
  });

  it('records where a card came from, defaulting to hand-written', () => {
    expect(bulkCreateRequest.parse({ deckId: CUID, cards: [{ front: 'q', back: 'a' }] }).source)
      .toBe('MANUAL');
  });
});

describe('reviews', () => {
  const valid = { id: UUID, cardId: CUID, rating: 3, reviewedAt: '2026-01-01T10:00:00Z' };

  it('requires a client-generated id — this is the idempotency key', () => {
    expect(submitReviewRequest.safeParse(valid).success).toBe(true);
    // A server-generated id would defeat the purpose: a retry must carry the
    // same one, and only the device knows it.
    expect(submitReviewRequest.safeParse({ ...valid, id: 'not-a-uuid' }).success).toBe(false);
  });

  it('accepts only the four ratings the engine knows', () => {
    for (const rating of [1, 2, 3, 4]) {
      expect(submitReviewRequest.safeParse({ ...valid, rating }).success).toBe(true);
    }
    for (const rating of [0, 5, 2.5, -1]) {
      expect(submitReviewRequest.safeParse({ ...valid, rating }).success).toBe(false);
    }
  });

  it('parses the device timestamp into a real date', () => {
    expect(submitReviewRequest.parse(valid).reviewedAt).toBeInstanceOf(Date);
  });

  it('caps an offline batch', () => {
    const batch = (n: number) => ({
      reviews: Array.from({ length: n }, () => valid),
    });
    expect(batchReviewRequest.safeParse(batch(200)).success).toBe(true);
    expect(batchReviewRequest.safeParse(batch(201)).success).toBe(false);
  });

  it('gives the review queue a sane default size', () => {
    expect(queueQuery.parse({}).limit).toBe(50);
    expect(queueQuery.parse({}).ahead).toBe(false);
    expect(queueQuery.safeParse({ limit: 500 }).success).toBe(false);
  });

  it('coerces query strings, because they arrive as text', () => {
    const parsed = queueQuery.parse({ limit: '25', ahead: 'true' });
    expect(parsed.limit).toBe(25);
    expect(parsed.ahead).toBe(true);
  });
});

describe('ai generation', () => {
  const base = { deckId: CUID };

  it('takes a topic or some text, but not both', () => {
    expect(generateRequest.safeParse({ ...base, topic: 'Kubernetes' }).success).toBe(true);
    expect(
      generateRequest.safeParse({ ...base, text: 'x'.repeat(60) }).success,
    ).toBe(true);

    // Both would make the prompt ambiguous; neither leaves nothing to work from.
    expect(
      generateRequest.safeParse({ ...base, topic: 'Kubernetes', text: 'x'.repeat(60) }).success,
    ).toBe(false);
    expect(generateRequest.safeParse(base).success).toBe(false);
  });

  it('caps how many cards one request may ask for', () => {
    expect(generateRequest.parse({ ...base, topic: 'Rust' }).count).toBe(10);
    expect(generateRequest.safeParse({ ...base, topic: 'Rust', count: 21 }).success).toBe(false);
  });

  it('refuses a text blob too short to be worth generating from', () => {
    expect(generateRequest.safeParse({ ...base, text: 'too short' }).success).toBe(false);
  });
});

describe('shared shapes', () => {
  it('paginates by cursor, never by offset', () => {
    // Offset skips rows when data shifts under a reader; a cursor does not.
    expect(pageQuery.parse({}).limit).toBe(50);
    expect(pageQuery.parse({ limit: '10', cursor: 'abc' })).toEqual({ limit: 10, cursor: 'abc' });
    expect(pageQuery.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('wraps any item type in the same envelope', () => {
    const page = paginated(z.object({ id: z.string() }));
    expect(page.parse({ items: [{ id: 'a' }], nextCursor: null }).nextCursor).toBeNull();
    expect(page.safeParse({ items: [{ id: 'a' }] }).success).toBe(false);
  });

  it('always carries a trace id on an error', () => {
    // Without it a bug report is "it broke sometimes" and nothing is findable.
    expect(
      problemDetails.safeParse({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
      }).success,
    ).toBe(false);

    expect(
      problemDetails.safeParse({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        traceId: 'req_123',
      }).success,
    ).toBe(true);
  });
});
