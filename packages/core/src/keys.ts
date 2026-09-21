/**
 * Query keys, in one place.
 *
 * Invalidation is only as reliable as the keys are consistent: a key spelled
 * two ways is a cache that never refreshes, and nothing reports it. Hierarchical
 * on purpose, so `invalidate(keys.decks.all)` reaches every deck query.
 */
export const keys = {
  me: ['me'] as const,
  decks: {
    all: ['decks'] as const,
    list: (includeArchived = false) => ['decks', 'list', { includeArchived }] as const,
    detail: (id: string) => ['decks', 'detail', id] as const,
    stats: (id: string) => ['decks', 'stats', id] as const,
  },
  cards: {
    all: ['cards'] as const,
    list: (deckId: string | undefined, includeSuspended = false) =>
      ['cards', 'list', { deckId, includeSuspended }] as const,
  },
  review: {
    all: ['review'] as const,
    queue: (deckId?: string, ahead = false) => ['review', 'queue', { deckId, ahead }] as const,
    explain: (cardId: string) => ['review', 'explain', cardId] as const,
    history: (cardId?: string) => ['review', 'history', { cardId }] as const,
  },
  stats: {
    all: ['stats'] as const,
    overview: ['stats', 'overview'] as const,
    heatmap: (days: number) => ['stats', 'heatmap', days] as const,
    forecast: (days: number, deckId?: string) => ['stats', 'forecast', { days, deckId }] as const,
    curve: (target: { cardId?: string; deckId?: string }) => ['stats', 'curve', target] as const,
    workload: ['stats', 'workload'] as const,
  },
  ai: { usage: ['ai', 'usage'] as const },
  optimizer: { status: ['optimizer', 'status'] as const },
} as const;
