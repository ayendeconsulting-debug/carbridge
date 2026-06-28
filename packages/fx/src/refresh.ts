import type { FxProvider, FxPair, FxSnapshot, FxRefreshConfig } from "./types";
import { applySpread } from "./spread";
import { isStale, DEFAULT_STALE_THRESHOLD_MS } from "./staleness";

/**
 * Fetch a raw rate from the provider, apply CarBridge's spread, and return a
 * snapshot ready to persist (FxRate row) and cache (Upstash).
 *
 * Pure orchestration: persistence and caching are the caller's job, so this
 * works identically in a Next.js route handler (Path A) or a NestJS service
 * (Path B).
 */
export async function refreshFxRate(
  provider: FxProvider,
  pair: FxPair,
  config: FxRefreshConfig = {},
): Promise<FxSnapshot> {
  const quote = await provider.getRate(pair);
  const effectiveRate = applySpread(quote.rawRate, config.spreadBps ?? 0);
  const now = config.now ?? new Date();
  return {
    pair,
    rawRate: quote.rawRate,
    effectiveRate,
    source: quote.source,
    fetchedAt: quote.fetchedAt,
    isStale: isStale(
      quote.fetchedAt,
      now,
      config.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS,
    ),
  };
}
