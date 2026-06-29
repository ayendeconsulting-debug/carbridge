// Factory for the quote/invoice seam. Same selection shape as the other
// dev/real splits: the dev path needs nothing (defaults to the stub); dropping
// in credentials (and leaving QUOTE_INVOICE_DEV_STUB unset) flips it to real.
//
//   QUOTE_INVOICE_DEV_STUB=1   -> always the stub (local default)
//   QUOTE_INVOICE_API_URL +    -> the real REST adapter
//   QUOTE_INVOICE_API_KEY
//   (+ optional QUOTE_INVOICE_WEBHOOK_SECRET, QUOTE_INVOICE_PLATFORM_NAME)
//
// With neither the stub flag nor full credentials present, we fall back to the
// stub so the app never hard-fails on a missing integration (null-safe, like
// the Redis fallback).

import type { QuoteInvoiceProvider } from "./types";
import { createStubQuoteInvoiceProvider } from "./stub";
import { createRealQuoteInvoiceProvider } from "./real";

let cached: QuoteInvoiceProvider | null = null;

function build(): QuoteInvoiceProvider {
  const forceStub = process.env.QUOTE_INVOICE_DEV_STUB === "1";
  const baseUrl = process.env.QUOTE_INVOICE_API_URL;
  const apiKey = process.env.QUOTE_INVOICE_API_KEY;

  if (!forceStub && baseUrl && apiKey) {
    return createRealQuoteInvoiceProvider({
      baseUrl,
      apiKey,
      webhookSecret: process.env.QUOTE_INVOICE_WEBHOOK_SECRET,
      platformName: process.env.QUOTE_INVOICE_PLATFORM_NAME,
    });
  }
  return createStubQuoteInvoiceProvider();
}

/** Returns the active provider (memoized per server runtime). */
export function getQuoteInvoiceProvider(): QuoteInvoiceProvider {
  if (!cached) cached = build();
  return cached;
}

export type {
  QuoteInvoiceProvider,
  CreateQuoteInput,
  QuoteResult,
  CreateInvoiceInput,
  InvoiceResult,
  RecordPaymentInput,
  PaymentResult,
  WebhookEvent,
  DocLineItem,
  BankInstructions,
} from "./types";
