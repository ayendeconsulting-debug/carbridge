export type {
  FxPair,
  FxRateQuote,
  FxProvider,
  FxSnapshot,
  FxRefreshConfig,
} from "./types";

export { applySpread } from "./spread";
export {
  isStale,
  ageSeconds,
  DEFAULT_STALE_THRESHOLD_MS,
} from "./staleness";
export {
  createOpenErApiProvider,
  createFixedProvider,
  createJitterProvider,
  type OpenErApiOptions,
  type FixedProviderOptions,
  type JitterProviderOptions,
} from "./providers";
export { refreshFxRate } from "./refresh";
export {
  createRateLock,
  isRateLockValid,
  rateLockRemainingMs,
  RATE_LOCK_TTL_MS,
  type RateLockContext,
  type CreateRateLockInput,
  type RateLockRecord,
} from "./rate-lock";
