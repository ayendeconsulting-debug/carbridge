// Real REST adapter for the external quote/invoice platform.
//
// SCAFFOLD ONLY (slice 1). The seam, config and selection logic are complete;
// the HTTP bodies are intentionally left for slice 4, once the platform's API
// contract is in hand (base URL, auth, create-quote / create-invoice endpoints
// + payload shapes, and the webhook event + signature scheme). Until then each
// method throws a clear, actionable error rather than guessing endpoints.
//
// Selected by ./index.ts only when QUOTE_INVOICE_DEV_STUB is unset AND both
// QUOTE_INVOICE_API_URL and QUOTE_INVOICE_API_KEY are present — so local dev
// always uses the stub and never reaches this file.

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

export interface RealQuoteInvoiceConfig {
  baseUrl: string;
  apiKey: string;
  /** Shared secret used to verify inbound webhook signatures (slice 4). */
  webhookSecret?: string;
  /** Display name for logs/audit, e.g. the platform's product name. */
  platformName?: string;
}

export class QuoteInvoiceNotConfiguredError extends Error {
  constructor(method: string) {
    super(
      `QuoteInvoiceProvider.${method} is not implemented yet. ` +
        `The real REST adapter lands in slice 4 once the platform API contract is provided. ` +
        `For now run with QUOTE_INVOICE_DEV_STUB=1 (or omit QUOTE_INVOICE_API_URL/KEY) to use the stub.`,
    );
    this.name = "QuoteInvoiceNotConfiguredError";
  }
}

export function createRealQuoteInvoiceProvider(
  config: RealQuoteInvoiceConfig,
): QuoteInvoiceProvider {
  // config is captured now so slice 4 only fills in the request bodies.
  void config;

  return {
    name: config.platformName ?? "platform",
    isStub: false,

    async createQuote(_input: CreateQuoteInput): Promise<QuoteResult> {
      throw new QuoteInvoiceNotConfiguredError("createQuote");
    },

    async createInvoice(_input: CreateInvoiceInput): Promise<InvoiceResult> {
      throw new QuoteInvoiceNotConfiguredError("createInvoice");
    },

    async recordPayment(_input: RecordPaymentInput): Promise<PaymentResult> {
      throw new QuoteInvoiceNotConfiguredError("recordPayment");
    },

    verifyWebhook(_rawBody: string, _signature: string | null): boolean {
      // Slice 4: HMAC verify _rawBody against config.webhookSecret.
      throw new QuoteInvoiceNotConfiguredError("verifyWebhook");
    },

    parseWebhook(_rawBody: string): WebhookEvent | null {
      throw new QuoteInvoiceNotConfiguredError("parseWebhook");
    },
  };
}
