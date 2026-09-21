import type { UpdateCardRequest, UpdateDeckRequest, UpdateSettingsRequest } from '@recallify/contracts';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { createContext, createElement, useContext, type ReactNode } from 'react';
import type {
  ApiClient,
  CreateCardInput,
  CreateDeckInput,
  DraftCard,
  GenerateInput,
} from '../api/client';
import { ApiError } from '../api/http';
import { keys } from '../keys';

/**
 * React Query hooks over the API client.
 *
 * Shared between web and mobile: both use React and TanStack Query, and the
 * only thing that differs is the client each one puts in the provider. No DOM,
 * no JSX (createElement below), so this compiles for React Native unchanged.
 */

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider(props: { client: ApiClient; children: ReactNode }) {
  return createElement(ApiContext.Provider, { value: props.client }, props.children);
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi called outside <ApiProvider>');
  return client;
}

/** A 4xx is an answer, not an outage. Retrying it only delays the message. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
}

// ---------------------------------------------------------------- account

export function useMe(options: { enabled?: boolean } = {}) {
  const api = useApi();
  return useQuery({ queryKey: keys.me, queryFn: api.me, enabled: options.enabled ?? true });
}

export function useUpdateSettings() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSettingsRequest) => api.updateSettings(body),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user);
      // A new retention target changes the workload estimate and the curves.
      void qc.invalidateQueries({ queryKey: keys.stats.all });
    },
  });
}

// ---------------------------------------------------------------- decks

export function useDecks(includeArchived = false) {
  const api = useApi();
  return useQuery({
    queryKey: keys.decks.list(includeArchived),
    queryFn: () => api.decks.list({ includeArchived, limit: 100 }),
  });
}

export function useDeck(id: string) {
  const api = useApi();
  return useQuery({ queryKey: keys.decks.detail(id), queryFn: () => api.decks.get(id) });
}

export function useDeckStats(id: string) {
  const api = useApi();
  return useQuery({ queryKey: keys.decks.stats(id), queryFn: () => api.decks.stats(id) });
}

function refreshDecks(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: keys.decks.all });
  void qc.invalidateQueries({ queryKey: keys.stats.all });
  void qc.invalidateQueries({ queryKey: keys.review.all });
}

export function useCreateDeck() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDeckInput) => api.decks.create(body),
    onSuccess: () => refreshDecks(qc),
  });
}

export function useUpdateDeck(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDeckRequest) => api.decks.update(id, body),
    onSuccess: () => refreshDecks(qc),
  });
}

export function useDeleteDeck() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.decks.remove(id),
    onSuccess: () => {
      refreshDecks(qc);
      void qc.invalidateQueries({ queryKey: keys.cards.all });
    },
  });
}

// ---------------------------------------------------------------- cards

export function useCards(deckId: string, includeSuspended = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.cards.list(deckId, includeSuspended),
    queryFn: () => api.cards.list({ deckId, includeSuspended, limit: 100 }),
  });
}

function refreshCards(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: keys.cards.all });
  refreshDecks(qc);
}

export function useCreateCard() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCardInput) => api.cards.create(body),
    onSuccess: () => refreshCards(qc),
  });
}

export function useBulkCreateCards() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { deckId: string; source?: 'MANUAL' | 'AI' | 'IMPORT'; cards: DraftCard[] }) =>
      api.cards.bulk(body),
    onSuccess: () => refreshCards(qc),
  });
}

export function useUpdateCard() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; body: UpdateCardRequest }) =>
      api.cards.update(input.id, input.body),
    onSuccess: () => refreshCards(qc),
  });
}

export function useSuspendCard() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; suspended: boolean }) =>
      api.cards.suspend(input.id, input.suspended),
    onSuccess: () => refreshCards(qc),
  });
}

export function useDeleteCard() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cards.remove(id),
    onSuccess: () => refreshCards(qc),
  });
}

// ---------------------------------------------------------------- review

export function useQueue(deckId?: string, ahead = false) {
  const api = useApi();
  return useQuery({
    queryKey: keys.review.queue(deckId, ahead),
    queryFn: () => api.review.queue({ ...(deckId ? { deckId } : {}), ahead, limit: 100 }),
    // A session works through the queue it started with. Refetching under it
    // would reshuffle the cards while the user is mid-answer.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useExplain(cardId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: keys.review.explain(cardId ?? ''),
    queryFn: () => api.review.explain(cardId as string),
    enabled: cardId !== null,
  });
}

// ---------------------------------------------------------------- stats

export function useOverview() {
  const api = useApi();
  return useQuery({ queryKey: keys.stats.overview, queryFn: api.stats.overview });
}

export function useHeatmap(days = 365) {
  const api = useApi();
  return useQuery({ queryKey: keys.stats.heatmap(days), queryFn: () => api.stats.heatmap(days) });
}

export function useForecast(days = 30, deckId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: keys.stats.forecast(days, deckId),
    queryFn: () => api.stats.forecast({ days, ...(deckId ? { deckId } : {}) }),
  });
}

export function useCurve(target: { cardId?: string; deckId?: string }, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.stats.curve(target),
    queryFn: () => api.stats.curve(target),
    enabled,
  });
}

export function useWorkload() {
  const api = useApi();
  return useQuery({ queryKey: keys.stats.workload, queryFn: api.stats.workload });
}

// ---------------------------------------------------------------- ai

export function useAiUsage() {
  const api = useApi();
  return useQuery({ queryKey: keys.ai.usage, queryFn: api.ai.usage });
}

export function useGenerateCards() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateInput) => api.ai.generate(body),
    // Success or failure, the allowance may have moved.
    onSettled: () => void qc.invalidateQueries({ queryKey: keys.ai.usage }),
  });
}

// ---------------------------------------------------------------- optimizer

export function useOptimizerStatus() {
  const api = useApi();
  return useQuery({ queryKey: keys.optimizer.status, queryFn: api.optimizer.status });
}

export function useRunOptimizer() {
  const api = useApi();
  return useMutation({ mutationFn: () => api.optimizer.run() });
}

export function useApplyParams() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: number[] | null) =>
      params ? api.optimizer.apply(params) : api.optimizer.reset(),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user);
      void qc.invalidateQueries({ queryKey: keys.optimizer.status });
      void qc.invalidateQueries({ queryKey: keys.stats.all });
    },
  });
}
