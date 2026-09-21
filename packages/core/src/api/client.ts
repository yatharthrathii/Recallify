import {
  aiUsage,
  batchReviewResponse,
  bulkCreateResponse,
  card,
  currentUser,
  deck,
  deckStats,
  explanation,
  forecast,
  forgettingCurve,
  generateResult,
  heatmapResponse,
  optimizerRunResponse,
  optimizerStatus,
  paginated,
  queueResponse,
  reviewHistoryItem,
  reviewOutcome,
  statsOverview,
  workloadPreview,
  type AiReportRequest,
  type BatchReviewRequest,
  type SubmitReviewRequest,
  type UpdateCardRequest,
  type UpdateDeckRequest,
  type UpdateSettingsRequest,
} from '@recallify/contracts';
import { Transport, type TransportOptions } from './http';

const deckPage = paginated(deck);
const cardPage = paginated(card);
const historyPage = paginated(reviewHistoryItem);

export interface CreateDeckInput {
  title: string;
  description?: string;
  color?: string;
}

export interface CreateCardInput {
  deckId: string;
  front: string;
  back: string;
  hint?: string;
}

export interface DraftCard {
  front: string;
  back: string;
  hint?: string | undefined;
}

export interface GenerateInput {
  deckId: string;
  count: number;
  topic?: string;
  text?: string;
}

/**
 * Every endpoint, typed by the same Zod contracts the server validates with.
 *
 * Platform-neutral on purpose: the web app points it at its own origin and
 * lets cookies carry the session, the phone points it at the API and supplies
 * a bearer token. Nothing else differs between them.
 */
export function createApiClient(options: TransportOptions) {
  const http = new Transport(options);

  return {
    me: () => http.request('/auth/me', { schema: currentUser }),
    updateSettings: (body: UpdateSettingsRequest) =>
      http.request('/auth/me', { method: 'PATCH', body, schema: currentUser }),
    deleteAccount: (password: string) =>
      http.request('/auth/me', { method: 'DELETE', body: { password } }),

    decks: {
      list: (query: { cursor?: string; limit?: number; includeArchived?: boolean } = {}) =>
        http.request('/decks', { query, schema: deckPage }),
      get: (id: string) => http.request(`/decks/${id}`, { schema: deck }),
      stats: (id: string) => http.request(`/decks/${id}/stats`, { schema: deckStats }),
      create: (body: CreateDeckInput) =>
        http.request('/decks', { method: 'POST', body, schema: deck }),
      update: (id: string, body: UpdateDeckRequest) =>
        http.request(`/decks/${id}`, { method: 'PATCH', body, schema: deck }),
      remove: (id: string) => http.request(`/decks/${id}`, { method: 'DELETE' }),
    },

    cards: {
      list: (
        query: { deckId?: string; cursor?: string; limit?: number; includeSuspended?: boolean } = {},
      ) => http.request('/cards', { query, schema: cardPage }),
      get: (id: string) => http.request(`/cards/${id}`, { schema: card }),
      create: (body: CreateCardInput) =>
        http.request('/cards', { method: 'POST', body, schema: card }),
      bulk: (body: { deckId: string; source?: 'MANUAL' | 'AI' | 'IMPORT'; cards: DraftCard[] }) =>
        http.request('/cards/bulk', { method: 'POST', body, schema: bulkCreateResponse }),
      update: (id: string, body: UpdateCardRequest) =>
        http.request(`/cards/${id}`, { method: 'PATCH', body, schema: card }),
      suspend: (id: string, suspended: boolean) =>
        http.request(`/cards/${id}/suspend`, { method: 'POST', body: { suspended }, schema: card }),
      remove: (id: string) => http.request(`/cards/${id}`, { method: 'DELETE' }),
    },

    review: {
      queue: (query: { deckId?: string; limit?: number; ahead?: boolean } = {}) =>
        http.request('/review/queue', { query, schema: queueResponse }),
      submit: (body: Omit<SubmitReviewRequest, 'reviewedAt'> & { reviewedAt: Date }) =>
        http.request('/review', {
          method: 'POST',
          body: { ...body, reviewedAt: body.reviewedAt.toISOString() },
          schema: reviewOutcome,
        }),
      batch: (body: BatchReviewRequest) =>
        http.request('/review/batch', { method: 'POST', body, schema: batchReviewResponse }),
      explain: (cardId: string) =>
        http.request(`/review/explain/${cardId}`, { schema: explanation }),
      history: (query: { cardId?: string; cursor?: string; limit?: number } = {}) =>
        http.request('/review/history', { query, schema: historyPage }),
    },

    stats: {
      overview: () => http.request('/stats/overview', { schema: statsOverview }),
      heatmap: (days = 365) =>
        http.request('/stats/heatmap', { query: { days }, schema: heatmapResponse }),
      forecast: (query: { days?: number; deckId?: string } = {}) =>
        http.request('/stats/forecast', { query, schema: forecast }),
      curve: (query: { cardId?: string; deckId?: string }) =>
        http.request('/stats/curve', { query, schema: forgettingCurve }),
      workload: () => http.request('/stats/workload', { schema: workloadPreview }),
    },

    ai: {
      generate: (body: GenerateInput) =>
        http.request('/ai/generate', { method: 'POST', body, schema: generateResult }),
      usage: () => http.request('/ai/usage', { schema: aiUsage }),
      report: (body: AiReportRequest) => http.request('/ai/report', { method: 'POST', body }),
    },

    optimizer: {
      status: () => http.request('/optimizer/status', { schema: optimizerStatus }),
      run: () => http.request('/optimizer/run', { method: 'POST', schema: optimizerRunResponse }),
      apply: (params: number[]) =>
        http.request('/optimizer/apply', { method: 'POST', body: { params }, schema: currentUser }),
      reset: () => http.request('/optimizer/reset', { method: 'POST', schema: currentUser }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
