// @carbridge payments — a swappable payment-provider interface, mirroring the
// FxProvider pattern. The app talks to this interface only; Paystack vs stub
// (vs a future Flutterwave/Stripe adapter) is a one-line swap in selectProvider.

export type ChargeStatus = "success" | "failed" | "pending" | "unknown";

export interface InitCheckoutInput {
  /** Buyer email — required by Paystack to initialise a transaction. */
  email: string;
  /** Amount in kobo (integer minor unit; never floats). */
  amountKobo: number;
  /** Our unique reference for this checkout. */
  reference: string;
  /** Absolute URL the provider returns the buyer to after payment. */
  callbackUrl: string;
  /** Free-form metadata echoed back on verify/webhook (we put userId here). */
  metadata?: Record<string, unknown>;
}

export interface InitCheckoutResult {
  /** URL to redirect the buyer to (hosted checkout, or the local stub). */
  authorizationUrl: string;
  reference: string;
}

export interface VerifyResult {
  status: ChargeStatus;
  reference: string;
  amountKobo?: number;
  metadata?: Record<string, unknown>;
}

export interface WebhookEvent {
  /** e.g. "charge.success". */
  type: string;
  reference: string;
  status: ChargeStatus;
  amountKobo?: number;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly id: string;
  initCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult>;
  verifyTransaction(reference: string): Promise<VerifyResult>;
  /** True when the raw webhook body matches the provider signature. */
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  /** Parse a (already-verified) webhook body into a normalised event. */
  parseWebhook(rawBody: string): WebhookEvent | null;
}
