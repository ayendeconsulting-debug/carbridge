// @carbridge/fx - core types for the CAD→NGN FX feed.
// Rates are carried as decimal STRINGS (never JS floats) so they hand off
// cleanly to @carbridge/shared's cost engine and to Prisma's Decimal columns.

export type FxPair = "CAD_NGN";

/** A raw quote straight from a provider, before any spread/margin is applied. */
export interface FxRateQuote {
  pair: FxPair;
  /** NGN per 1 CAD, as a decimal string, e.g. "1149.5". */
  rawRate: string;
  /** Provider id that produced this quote, e.g. "open-er-api". */
  source: string;
  fetchedAt: Date;
}

/** A provider knows how to fetch a raw rate for a pair. Swappable by design. */
export interface FxProvider {
  readonly id: string;
  getRate(pair: FxPair): Promise<FxRateQuote>;
}

/**
 * A fully-resolved snapshot: raw provider rate + the effective rate actually
 * shown to buyers (after spread), plus a staleness flag. This is what gets
 * persisted to the FxRate table and cached for the live feed.
 */
export interface FxSnapshot {
  pair: FxPair;
  rawRate: string;
  effectiveRate: string;
  source: string;
  fetchedAt: Date;
  isStale: boolean;
}

export interface FxRefreshConfig {
  /**
   * Margin applied on top of the raw rate, in basis points (1 bp = 0.01%).
   * 150 => +1.50%. Defaults to 0. This is CarBridge's FX margin/spread -
   * configure via FX_SPREAD_BPS. See the OQ-2 note in the README about
   * official vs. market (parallel) rates.
   */
  spreadBps?: string | number;
  /** How old a quote may be before it's flagged stale. Default 60 min. */
  staleThresholdMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}
