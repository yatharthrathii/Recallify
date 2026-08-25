export * from './types';
export {
  DEFAULT_PARAMS,
  DEFAULT_CONFIG,
  S_MIN,
  S_MAX,
  INIT_S_MAX,
  D_MIN,
  D_MAX,
  CURVE_ANCHOR,
  clamp,
} from './constants';
export { newCard, elapsedDays, addDays, DAY_MS } from './defaults';
export {
  decay,
  curveFactor,
  retrievability,
  intervalFromRetention,
  initialStability,
  initialDifficulty,
  linearDamping,
  meanReversion,
  nextDifficulty,
  nextRecallStability,
  nextForgetStability,
  nextShortTermStability,
} from './memory';

/**
 * Phase 2b adds the state machine on top of this memory model:
 *
 *   schedule(card, rating, now, config) -> SchedulingResult
 *   explain(card, now, config)          -> Explanation
 *   replay(logs, config)                -> SchedulingCard
 *
 * The model above is the hard part and is pinned by differential tests; the
 * state machine is learning steps, graduation and interval fuzz around it.
 */
