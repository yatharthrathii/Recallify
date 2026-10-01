import type { UpdateCardRequest, UpdateDeckRequest, UpdateSettingsRequest } from '@recallify/contracts';
import {
  keepPreviousData,
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
  ImportChunkInput,
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
  // A rename, an archive or a card write changes what the library shows: a
  // published deck's changelog, a copy's pending count, the list itself.
  void qc.invalidateQueries({ queryKey: keys.library.all });
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

export function useExam(date: string | null, deckId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: keys.stats.exam(date ?? '', deckId),
    queryFn: () => api.stats.exam({ date: date as string, ...(deckId ? { deckId } : {}) }),
    enabled: date !== null,
  });
}

// ---------------------------------------------------------------- import

/**
 * One request of an import. The caller loops over chunks; each success
 * changes the deck list, the stats and the queue, so all three refresh.
 */
export function useImportCards() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportChunkInput) => api.importCards(body),
    onSuccess: () => {
      refreshCards(qc);
      void qc.invalidateQueries({ queryKey: keys.report.status });
    },
  });
}

// ---------------------------------------------------------------- library

export function useLibrary(q?: string) {
  const api = useApi();
  return useQuery({
    queryKey: keys.library.list(q),
    queryFn: () => api.library.list({ ...(q ? { q } : {}), limit: 50 }),
    // The last list stays on screen while a new search loads, instead of
    // skeletons flashing on every keystroke.
    placeholderData: keepPreviousData,
  });
}

export function useLibraryDeck(deckId: string) {
  const api = useApi();
  return useQuery({
    queryKey: keys.library.detail(deckId),
    queryFn: () => api.library.detail(deckId),
  });
}

export function useDeckChanges(deckId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.library.changes(deckId),
    queryFn: () => api.library.changes(deckId, { limit: 50 }),
    enabled,
  });
}

/** For a subscribed copy: what a sync would do, and the author's notes since. */
export function useSubscription(deckId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.library.status(deckId),
    queryFn: () => api.library.status(deckId),
    enabled,
  });
}

function refreshLibrary(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: keys.library.all });
  refreshCards(qc);
}

export function usePublishDeck() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { deckId: string; publish: boolean }) =>
      input.publish ? api.library.publish(input.deckId) : api.library.unpublish(input.deckId),
    onSuccess: () => refreshLibrary(qc),
  });
}

export function useAddDeckNote() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { deckId: string; text: string }) =>
      api.library.note(input.deckId, input.text),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.library.all }),
  });
}

export function useSubscribe() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deckId: string) => api.library.subscribe(deckId),
    onSuccess: () => refreshLibrary(qc),
  });
}

export function useSyncSubscription() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deckId: string) => api.library.sync(deckId),
    onSuccess: () => refreshLibrary(qc),
  });
}

export function useUnsubscribe() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deckId: string) => api.library.unsubscribe(deckId),
    onSuccess: () => refreshLibrary(qc),
  });
}

// ---------------------------------------------------------------- report

export function useReportStatus() {
  const api = useApi();
  return useQuery({ queryKey: keys.report.status, queryFn: api.report.status });
}

export function useReport(id: string) {
  const api = useApi();
  return useQuery({ queryKey: keys.report.detail(id), queryFn: () => api.report.get(id) });
}

/** Sends the visitor's UTC offset, so hour-of-day findings are in their own clock. */
export function useCreateReport() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.report.create(-new Date().getTimezoneOffset()),
    onSuccess: (report) => {
      qc.setQueryData(keys.report.detail(report.id), report);
      void qc.invalidateQueries({ queryKey: keys.report.all });
      // The exam forecast quotes the latest report's calibration.
      void qc.invalidateQueries({ queryKey: keys.stats.all });
    },
  });
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
