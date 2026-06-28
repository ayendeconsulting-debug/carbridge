import {
  computeLandedCost,
  toDisplay,
  formatMoney,
  type ShippingMethod,
  type LandedCostDisplay,
} from "@carbridge/shared";
import type { VehicleCardView, VehicleDetailView } from "./types";

/** Inputs for one landed-cost computation. */
export interface LandedInput {
  purchasePriceCAD: string;
  shippingCostCAD: string;
  clearingCostNGN: string;
  fxRate: string;
  handlingRate?: string | null;
}

export function landed(input: LandedInput): LandedCostDisplay {
  return toDisplay(
    computeLandedCost({
      purchasePriceCAD: input.purchasePriceCAD,
      shippingCostCAD: input.shippingCostCAD,
      clearingCostNGN: input.clearingCostNGN,
      fxRate: input.fxRate,
      handlingRate: input.handlingRate ?? undefined,
    }),
  );
}

/** Card total at the default shipping method. */
export function cardTotal(v: VehicleCardView, fxRate: string): { ngn: string; cad: string } {
  const d = landed({
    purchasePriceCAD: v.purchasePriceCAD,
    shippingCostCAD: v.defaultShippingCostCAD,
    clearingCostNGN: v.clearingCostNGN,
    fxRate,
    handlingRate: v.handlingRate,
  });
  return { ngn: d.total.ngn, cad: d.total.cad };
}

/** Detail ledger for a chosen shipping method. */
export function detailLedger(
  v: VehicleDetailView,
  method: ShippingMethod,
  fxRate: string,
): LandedCostDisplay {
  const opt =
    v.shippingOptions.find((o) => o.method === method) ?? v.shippingOptions[0];
  return landed({
    purchasePriceCAD: v.purchasePriceCAD,
    shippingCostCAD: opt ? opt.costCAD : "0",
    clearingCostNGN: v.clearingCostNGN,
    fxRate,
    handlingRate: v.handlingRate,
  });
}

export const fmtCAD = (n: number | string) => formatMoney(n, "CAD");
export const fmtNGN = (n: number | string) => formatMoney(n, "NGN");

/** "1 CAD ≈ ₦1,167" style rate label. */
export function rateLabel(effectiveRate: string): string {
  return `1 CAD = ${formatMoney(effectiveRate, "NGN")}`;
}

export function agoLabel(ageSeconds: number): string {
  if (ageSeconds <= 1) return "updated now";
  if (ageSeconds < 60) return `updated ${ageSeconds}s ago`;
  const m = Math.floor(ageSeconds / 60);
  return `updated ${m}m ago`;
}
