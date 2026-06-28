import type Decimal from 'decimal.js';
import type { DecimalInput } from './money';

export type ShippingMethod = 'RORO' | 'CONTAINER';
export type ContainerType = 'SHARED' | 'SOLE';

/** Global default handling rate (12%). Held as a string to stay float-free. */
export const DEFAULT_HANDLING_RATE = '0.12';

/**
 * Inputs to the landed-cost engine. Money values should be passed as strings
 * (e.g. Prisma Decimal `.toString()`) for exactness; numbers are accepted for
 * convenience but can carry float imprecision at the boundary.
 */
export interface LandedCostInput {
  /** Purchase price in CAD (admin-set). */
  purchasePriceCAD: DecimalInput;
  /** Selected shipping method's cost in CAD (RoRo or container). */
  shippingCostCAD: DecimalInput;
  /** Clearing cost in NGN — manual agent quotation, held fixed in naira. */
  clearingCostNGN: DecimalInput;
  /** Effective FX rate: NGN per 1 CAD (post-spread). Must be > 0. */
  fxRate: DecimalInput;
  /** Handling rate; defaults to 0.12. Allows a per-listing override. */
  handlingRate?: DecimalInput;
}

export type LineKey = 'purchase' | 'shipping' | 'clearing' | 'handling' | 'total';

/** A value carried in both currencies at full precision. */
export interface MoneyValue {
  cad: Decimal;
  ngn: Decimal;
}

export interface LandedCostLine extends MoneyValue {
  key: LineKey;
  label: string;
}

/** Full-precision breakdown. The server keeps this; never round before this point. */
export interface LandedCostBreakdown {
  fxRate: Decimal;
  handlingRate: Decimal;
  /** purchase -> shipping -> clearing -> handling -> total, each in CAD + NGN. */
  lines: LandedCostLine[];
  /** Pre-handling landed subtotal (the base the 12% applies to). */
  subtotal: MoneyValue;
  handling: MoneyValue;
  total: MoneyValue;
}

/* ---- display / transport shapes ---- */

export interface DisplayLine {
  key: LineKey;
  label: string;
  cad: string;
  ngn: string;
}

export interface LandedCostDisplay {
  fxRate: string;
  lines: DisplayLine[];
  subtotal: { cad: string; ngn: string };
  handling: { cad: string; ngn: string };
  total: { cad: string; ngn: string };
}

export interface SerializedMoney {
  cad: string;
  ngn: string;
}

/** JSON-safe, rounded to each currency's minor unit — the authoritative stored figures. */
export interface SerializedBreakdown {
  fxRate: string;
  handlingRate: string;
  lines: Array<{ key: LineKey; label: string; cad: string; ngn: string }>;
  subtotal: SerializedMoney;
  handling: SerializedMoney;
  total: SerializedMoney;
}

export interface ShippingOptionInput {
  method: ShippingMethod;
  containerType?: ContainerType;
  costCAD: DecimalInput;
}
