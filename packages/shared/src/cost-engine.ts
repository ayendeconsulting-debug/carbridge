import Decimal from 'decimal.js';
import { D, formatMoney, roundMoney, MINOR_UNITS, type Currency } from './money';
import {
  DEFAULT_HANDLING_RATE,
  type LandedCostInput,
  type LandedCostBreakdown,
  type LandedCostLine,
  type LandedCostDisplay,
  type DisplayLine,
  type SerializedBreakdown,
  type ShippingOptionInput,
  type ShippingMethod,
} from './types';

function toNonNegative(name: string, value: Decimal.Value): Decimal {
  const d = new D(value);
  if (d.isNaN() || !d.isFinite()) throw new Error(`${name} must be a finite number`);
  if (d.isNegative()) throw new Error(`${name} must not be negative`);
  return d;
}

/**
 * Compute the landed cost per SRD §8 (base currency NGN).
 *
 *   subtotalNGN = (P + S) * r + C
 *   handlingNGN = subtotalNGN * h        // 12% of the FULL landed subtotal
 *   totalNGN    = subtotalNGN * (1 + h)
 *   totalCAD    = totalNGN / r
 *
 * Returns full-precision Decimals. Round only at the display/storage boundary
 * via `toDisplay` / `serializeLandedCost`.
 */
export function computeLandedCost(input: LandedCostInput): LandedCostBreakdown {
  const P = toNonNegative('purchasePriceCAD', input.purchasePriceCAD);
  const S = toNonNegative('shippingCostCAD', input.shippingCostCAD);
  const C = toNonNegative('clearingCostNGN', input.clearingCostNGN);

  const r = new D(input.fxRate);
  if (r.isNaN() || !r.isFinite() || r.lte(0)) {
    throw new Error('fxRate must be a positive number (NGN per 1 CAD)');
  }

  const h =
    input.handlingRate === undefined
      ? new D(DEFAULT_HANDLING_RATE)
      : toNonNegative('handlingRate', input.handlingRate);

  const purchaseNGN = P.times(r);
  const shippingNGN = S.times(r);
  const clearingNGN = C;

  const subtotalNGN = purchaseNGN.plus(shippingNGN).plus(clearingNGN);
  const handlingNGN = subtotalNGN.times(h);
  const totalNGN = subtotalNGN.plus(handlingNGN);

  const toCad = (ngn: Decimal): Decimal => ngn.div(r);

  const lines: LandedCostLine[] = [
    { key: 'purchase', label: 'Purchase price', cad: P, ngn: purchaseNGN },
    { key: 'shipping', label: 'Shipping', cad: S, ngn: shippingNGN },
    { key: 'clearing', label: 'Clearing (Lagos)', cad: toCad(clearingNGN), ngn: clearingNGN },
    {
      key: 'handling',
      label: `Handling (${h.times(100).toString()}%)`,
      cad: toCad(handlingNGN),
      ngn: handlingNGN,
    },
    { key: 'total', label: 'Total landed', cad: toCad(totalNGN), ngn: totalNGN },
  ];

  return {
    fxRate: r,
    handlingRate: h,
    lines,
    subtotal: { cad: toCad(subtotalNGN), ngn: subtotalNGN },
    handling: { cad: toCad(handlingNGN), ngn: handlingNGN },
    total: { cad: toCad(totalNGN), ngn: totalNGN },
  };
}

/** Format a breakdown for the buyer-facing ledger (symbols + grouping, rounded). */
export function toDisplay(b: LandedCostBreakdown): LandedCostDisplay {
  const lines: DisplayLine[] = b.lines.map((l) => ({
    key: l.key,
    label: l.label,
    cad: formatMoney(l.cad, 'CAD'),
    ngn: formatMoney(l.ngn, 'NGN'),
  }));
  return {
    fxRate: b.fxRate.toString(),
    lines,
    subtotal: { cad: formatMoney(b.subtotal.cad, 'CAD'), ngn: formatMoney(b.subtotal.ngn, 'NGN') },
    handling: { cad: formatMoney(b.handling.cad, 'CAD'), ngn: formatMoney(b.handling.ngn, 'NGN') },
    total: { cad: formatMoney(b.total.cad, 'CAD'), ngn: formatMoney(b.total.ngn, 'NGN') },
  };
}

/** JSON-safe, rounded to each currency's minor unit - the authoritative stored figures. */
export function serializeLandedCost(b: LandedCostBreakdown): SerializedBreakdown {
  const money = (value: Decimal, currency: Currency): string =>
    roundMoney(value, currency).toFixed(MINOR_UNITS[currency]);
  return {
    fxRate: b.fxRate.toString(),
    handlingRate: b.handlingRate.toString(),
    lines: b.lines.map((l) => ({
      key: l.key,
      label: l.label,
      cad: money(l.cad, 'CAD'),
      ngn: money(l.ngn, 'NGN'),
    })),
    subtotal: { cad: money(b.subtotal.cad, 'CAD'), ngn: money(b.subtotal.ngn, 'NGN') },
    handling: { cad: money(b.handling.cad, 'CAD'), ngn: money(b.handling.ngn, 'NGN') },
    total: { cad: money(b.total.cad, 'CAD'), ngn: money(b.total.ngn, 'NGN') },
  };
}

/** Pick the cost (CAD) for a chosen shipping method, falling back to the first option. */
export function selectShippingCost(
  options: ShippingOptionInput[],
  method: ShippingMethod,
): Decimal {
  const chosen = options.find((o) => o.method === method) ?? options[0];
  if (!chosen) throw new Error('No shipping option available for this vehicle');
  return new D(chosen.costCAD);
}
