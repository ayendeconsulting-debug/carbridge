import { D } from "@carbridge/shared";

/**
 * Apply CarBridge's FX margin to a raw rate.
 *
 *   effectiveRate = rawRate × (1 + spreadBps / 10000)
 *
 * Uses the shared decimal.js config (precision 40, ROUND_HALF_UP), so rounding
 * is consistent with the landed-cost engine. Returns a decimal string.
 *
 * @param rawRate   NGN per 1 CAD (string | number)
 * @param spreadBps margin in basis points (1 bp = 0.01%); 150 => +1.50%
 */
export function applySpread(
  rawRate: string | number,
  spreadBps: string | number = 0,
): string {
  const raw = new D(rawRate);
  const bps = new D(spreadBps);
  const factor = new D(1).plus(bps.div(10000));
  return raw.times(factor).toString();
}
