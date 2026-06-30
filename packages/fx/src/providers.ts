import { D } from "@carbridge/shared";
import type { FxProvider, FxPair, FxRateQuote } from "./types";

/** Minimal fetch shape so we don't depend on DOM/node fetch typings. */
type FetchLike = (
  url: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const PAIR_TO_CODES: Record<FxPair, { base: string; quote: string }> = {
  CAD_NGN: { base: "CAD", quote: "NGN" },
};

export interface OpenErApiOptions {
  /** Injectable fetch for tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Override base URL (e.g. in tests). */
  baseUrl?: string;
}

/**
 * Default provider: open.er-api.com (the free, key-less endpoint of
 * exchangerate-api.com). Returns NGN per 1 CAD.
 *
 * NOTE (OQ-2): this is an *official-market* style reference rate. CarBridge may
 * want to show the parallel/market rate instead, or blend. Because everything
 * goes through the FxProvider interface, swapping the source is a one-file change
 * - no callers need to know.
 */
export function createOpenErApiProvider(
  opts: OpenErApiOptions = {},
): FxProvider {
  const fetchImpl: FetchLike | undefined =
    opts.fetchImpl ?? (globalThis as { fetch?: FetchLike }).fetch;
  const baseUrl = opts.baseUrl ?? "https://open.er-api.com/v6/latest";

  return {
    id: "open-er-api",
    async getRate(pair: FxPair): Promise<FxRateQuote> {
      if (!fetchImpl) {
        throw new Error("open-er-api: no fetch implementation available");
      }
      const { base, quote } = PAIR_TO_CODES[pair];
      const res = await fetchImpl(`${baseUrl}/${base}`);
      if (!res.ok) {
        throw new Error(`open-er-api: HTTP ${res.status}`);
      }
      const body = (await res.json()) as { rates?: Record<string, number> };
      const rate = body?.rates?.[quote];
      if (rate === undefined || rate === null) {
        throw new Error(`open-er-api: no ${quote} rate in response`);
      }
      return {
        pair,
        rawRate: String(rate),
        source: "open-er-api",
        fetchedAt: new Date(),
      };
    },
  };
}

export interface FixedProviderOptions {
  /** The raw rate this provider always returns. */
  rate: string | number;
  id?: string;
}

/**
 * Fixed provider - returns a constant rate. Useful for local dev (no network),
 * tests, and as a deterministic fallback. Pair the manual override here with an
 * admin-set rate when a live feed is unavailable.
 */
export function createFixedProvider(opts: FixedProviderOptions): FxProvider {
  const id = opts.id ?? "fixed";
  return {
    id,
    async getRate(pair: FxPair): Promise<FxRateQuote> {
      return {
        pair,
        rawRate: String(opts.rate),
        source: id,
        fetchedAt: new Date(),
      };
    },
  };
}

export interface JitterProviderOptions {
  /** Anchor rate the walk is centred on (NGN per 1 CAD). */
  center: string | number;
  /**
   * Max fraction of `center` the rate may move on a single call.
   * 0.004 => up to ±0.4% per tick. Default 0.004.
   */
  stepPct?: number;
  /**
   * Hard band around `center` the rate is clamped to, as a fraction.
   * 0.03 => the rate never strays beyond ±3% of `center`. Default 0.03.
   */
  bandPct?: number;
  /** Injectable RNG in [0, 1) for deterministic tests. Default Math.random. */
  random?: () => number;
  id?: string;
}

/**
 * DEV-ONLY provider. Returns a bounded random walk around `center` so the live
 * naira total visibly reprices on each refresh during local development. The
 * free open.er-api rate is near-static intraday, so without this the headline
 * "live reprice" feature can't be seen locally.
 *
 * Stateful by design: the walk remembers its last value (closure) and drifts
 * from it, then clamps to ±`bandPct` of `center` so it can't run away. All
 * arithmetic goes through `D` (decimal.js) - no floats - and the result is a
 * decimal string, identical in shape to every other provider.
 *
 * NEVER select this in production: gate it behind an explicit env flag
 * (see selectFxProvider in apps/web/lib/fx.ts). It is the dev/demo sibling of
 * createFixedProvider, not a real FX source.
 */
export function createJitterProvider(opts: JitterProviderOptions): FxProvider {
  const id = opts.id ?? "dev-jitter";
  const center = new D(opts.center);
  const stepPct = new D(opts.stepPct ?? 0.004);
  const bandPct = new D(opts.bandPct ?? 0.03);
  const rng = opts.random ?? Math.random;

  const lower = center.times(new D(1).minus(bandPct));
  const upper = center.times(new D(1).plus(bandPct));
  // Walk state starts at the anchor and persists across calls.
  let current = center;

  return {
    id,
    async getRate(pair: FxPair): Promise<FxRateQuote> {
      // delta ∈ [-stepPct, +stepPct] × center
      const signed = new D(rng()).times(2).minus(1); // [-1, 1)
      const delta = signed.times(stepPct).times(center);
      let next = current.plus(delta);
      if (next.lessThan(lower)) next = lower;
      if (next.greaterThan(upper)) next = upper;
      current = next;
      return {
        pair,
        rawRate: next.toString(),
        source: id,
        fetchedAt: new Date(),
      };
    },
  };
}
