import Decimal from 'decimal.js';

/**
 * A Decimal constructor configured for money:
 *  - high precision (40 significant digits) so intermediate division never drifts
 *  - default rounding HALF_UP
 *  - cloned, so we never mutate the global Decimal config in a consuming app
 *
 * All pricing math in CarBridge goes through `D`. Floating-point numbers are
 * never used for money - see the README.
 */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** Anything Decimal can construct from: a string (preferred for money), number, or Decimal. */
export type DecimalInput = Decimal.Value;

export type Currency = 'CAD' | 'NGN';

/** Minor-unit decimal places per currency. CAD settles to cents; NGN to whole naira. */
export const MINOR_UNITS: Record<Currency, number> = { CAD: 2, NGN: 0 };

/** Round a monetary value to its currency's minor unit, half-up. */
export function roundMoney(value: DecimalInput, currency: Currency): Decimal {
  return new D(value).toDecimalPlaces(MINOR_UNITS[currency], Decimal.ROUND_HALF_UP);
}

/**
 * Format money with its symbol and grouped thousands, rounded to the minor unit.
 * Deterministic and float-free (no Intl/Number), so server and client always agree.
 *   formatMoney(28221200, 'NGN') -> "₦28,221,200"
 *   formatMoney(24540.17, 'CAD') -> "$24,540.17"
 */
export function formatMoney(value: DecimalInput, currency: Currency): string {
  const rounded = roundMoney(value, currency);
  const negative = rounded.isNegative() && !rounded.isZero();
  const fixed = rounded.abs().toFixed(MINOR_UNITS[currency]);
  const [intPart, decPart] = fixed.split('.');
  const grouped = (intPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = decPart ? `${grouped}.${decPart}` : grouped;
  const symbol = currency === 'NGN' ? '₦' : '$';
  return `${negative ? '-' : ''}${symbol}${body}`;
}
