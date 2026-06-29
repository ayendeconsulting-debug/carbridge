import { D } from "@carbridge/shared";
import type { PaymentProvider } from "./types";
import { createPaystackProvider } from "./paystack";
import { createStubProvider } from "./stub";

export type { PaymentProvider } from "./types";
export { createPaystackProvider } from "./paystack";
export { createStubProvider } from "./stub";

/** Naira (string|number) -> integer kobo. Decimal-safe, no floats. */
export function nairaToKobo(naira: string | number): number {
  return Number(new D(naira).times(100).toDecimalPlaces(0).toString());
}

/** Integer kobo -> naira decimal string. */
export function koboToNaira(kobo: number): string {
  return new D(kobo).div(100).toString();
}

export interface Plan {
  name: string;
  /** Whole-naira price as a decimal string. */
  priceNgn: string;
  amountKobo: number;
}

/** Premium plan config (OQ-3: ₦45,000/yr assumed; override via env). */
export function getPlan(): Plan {
  const priceNgn = process.env.PREMIUM_PRICE_NGN ?? "45000";
  const name = process.env.PREMIUM_PLAN_NAME ?? "Ayende Autos Premium (annual)";
  return { name, priceNgn, amountKobo: nairaToKobo(priceNgn) };
}

/**
 * Choose the payment provider. Stub when explicitly forced OR when no Paystack
 * key is configured (local dev). Real Paystack otherwise. Same env-gated split
 * as the FX dev jitter.
 */
export function selectPaymentProvider(): PaymentProvider {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (process.env.PAYMENTS_DEV_STUB === "1" || !key) {
    return createStubProvider();
  }
  return createPaystackProvider({ secretKey: key });
}
