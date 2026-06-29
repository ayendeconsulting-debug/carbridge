// Dev stub for the quote/invoice seam. Mints deterministic fake numbers and
// ids so the whole quote -> invoice -> payment flow works end-to-end locally
// with no external platform. Selected by default (see ./index.ts) and whenever
// QUOTE_INVOICE_DEV_STUB=1. Mirrors the PAYMENTS_DEV_STUB pattern.

import type {
  QuoteInvoiceProvider,
  CreateQuoteInput,
  QuoteResult,
  CreateInvoiceInput,
  InvoiceResult,
  RecordPaymentInput,
  PaymentResult,
  WebhookEvent,
} from "./types";

/** Short, stable-ish suffix derived from a reference, for readable fake numbers. */
function suffix(reference: string): string {
  let h = 0;
  for (let i = 0; i < reference.length; i++) {
    h = (h * 31 + reference.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).toUpperCase().slice(0, 6).padStart(6, "0");
}

export function createStubQuoteInvoiceProvider(): QuoteInvoiceProvider {
  return {
    name: "stub",
    isStub: true,

    async createQuote(input: CreateQuoteInput): Promise<QuoteResult> {
      const s = suffix(input.reference);
      return {
        externalQuoteId: `stub_q_${input.reference}`,
        number: `Q-STUB-${s}`,
        url: null,
        status: "ISSUED",
      };
    },

    async createInvoice(input: CreateInvoiceInput): Promise<InvoiceResult> {
      const s = suffix(input.reference);
      return {
        externalInvoiceId: `stub_inv_${input.reference}`,
        number: `INV-STUB-${s}`,
        url: null,
        status: "ISSUED",
      };
    },

    async recordPayment(input: RecordPaymentInput): Promise<PaymentResult> {
      // The stub treats every recorded payment as settling the invoice in full;
      // real part-payment logic lives in the platform + the slice-3 reconciler.
      return {
        externalPaymentId: `stub_pay_${input.reference}`,
        invoiceStatus: "PAID",
        amountPaidNGN: input.amountNGN,
      };
    },

    // No signing locally — every delivery is "trusted" in dev.
    verifyWebhook(_rawBody: string, _signature: string | null): boolean {
      return true;
    },

    parseWebhook(rawBody: string): WebhookEvent | null {
      try {
        const body = JSON.parse(rawBody) as Record<string, unknown>;
        const externalInvoiceId =
          typeof body.externalInvoiceId === "string"
            ? body.externalInvoiceId
            : typeof body.invoiceId === "string"
              ? body.invoiceId
              : null;
        if (!externalInvoiceId) return null;
        return {
          type: typeof body.type === "string" ? body.type : "invoice.paid",
          externalInvoiceId,
          reference:
            typeof body.reference === "string" ? body.reference : undefined,
          amountPaidNGN:
            typeof body.amountPaidNGN === "string"
              ? body.amountPaidNGN
              : undefined,
          paidAt: typeof body.paidAt === "string" ? body.paidAt : undefined,
          raw: body,
        };
      } catch {
        return null;
      }
    },
  };
}
