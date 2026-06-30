// QuoteInvoiceProvider - the seam between CarBridge and the external
// quote/invoice platform (the system of record for documents + money).
//
// Same dev/real split as FX, Payments and Auth: a dev stub runs locally with
// zero external calls; the real REST adapter activates only when configured.
// All money is carried as decimal STRINGS (never floats), matching lib/types.ts
// and the @carbridge/shared cost engine.

export type Money = string; // decimal string, e.g. "28221200.00"
export type IsoDate = string; // ISO-8601 timestamp

/** One presented line of a quote/invoice, shown in both currencies. */
export interface DocLineItem {
  label: string; // "Purchase", "Shipping (RoRo)", "Clearing (Lagos)", "Handling (12%)"
  amountNGN: Money;
  amountCAD: Money;
}

export interface CustomerRef {
  name: string | null;
  email: string;
}

export interface VehicleRef {
  label: string; // "2019 Toyota RAV4 XLE"
  vin: string | null;
}

/** Bank details printed on a (manual-payment) invoice. */
export interface BankInstructions {
  bankName: string;
  accountName: string;
  accountNumber: string;
  reference?: string; // payment narration the buyer should quote
}

/* ----------------------------- create quote ----------------------------- */

export interface CreateQuoteInput {
  /** CarBridge-side correlation/idempotency key (the Quotation id). */
  reference: string;
  customer: CustomerRef;
  vehicle: VehicleRef;
  currency: "NGN"; // buyers transact in naira
  lineItems: DocLineItem[];
  totalNGN: Money;
  totalCAD: Money;
  fxRate: Money; // locked rate stamped on the document
  validUntil: IsoDate | null;
  notes?: string;
}

export interface QuoteResult {
  externalQuoteId: string;
  number: string; // human quote number assigned by the platform
  url: string | null; // hosted / PDF link, if the platform returns one
  status: string; // platform-native status
}

/* ---------------------------- create invoice ---------------------------- */

export interface CreateInvoiceInput {
  reference: string; // CarBridge-side key (the Invoice id)
  fromExternalQuoteId?: string; // convert an existing quote, when applicable
  kind: "CAR" | "MEMBERSHIP";
  customer: CustomerRef;
  currency: "NGN";
  amountNGN: Money;
  dueAt: IsoDate | null;
  lineItems: DocLineItem[];
  bankInstructions?: BankInstructions;
  notes?: string;
}

export interface InvoiceResult {
  externalInvoiceId: string;
  number: string;
  url: string | null;
  status: string;
}

/* ---------------------------- record payment ---------------------------- */

export interface RecordPaymentInput {
  externalInvoiceId: string;
  /** Dedup key - the bank-transfer / platform payment reference. */
  reference: string;
  amountNGN: Money;
  paidAt: IsoDate | null;
  note?: string;
}

export interface PaymentResult {
  externalPaymentId: string;
  invoiceStatus: string; // ISSUED / PART_PAID / PAID (platform-native)
  amountPaidNGN: Money; // cumulative paid on the invoice after this entry
}

/* ------------------------------- webhooks ------------------------------- */

export type WebhookEventType =
  | "invoice.issued"
  | "invoice.part_paid"
  | "invoice.paid"
  | "invoice.voided"
  | string;

export interface WebhookEvent {
  type: WebhookEventType;
  externalInvoiceId: string;
  reference?: string; // payment reference, when the event carries one
  amountPaidNGN?: Money;
  paidAt?: IsoDate;
  raw: unknown; // original payload, for audit
}

/* ------------------------------ the seam ------------------------------- */

export interface QuoteInvoiceProvider {
  /** Identifies which implementation is live (e.g. "stub", "<platform>"). */
  readonly name: string;
  /** True for the local stub - lets callers label dev-only documents. */
  readonly isStub: boolean;

  createQuote(input: CreateQuoteInput): Promise<QuoteResult>;
  createInvoice(input: CreateInvoiceInput): Promise<InvoiceResult>;
  recordPayment(input: RecordPaymentInput): Promise<PaymentResult>;

  /** Verify a webhook delivery's signature against the raw request body. */
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  /** Parse a verified webhook body into a normalized event, or null if unrecognized. */
  parseWebhook(rawBody: string): WebhookEvent | null;
}
