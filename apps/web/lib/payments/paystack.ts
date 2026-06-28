import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentProvider,
  InitCheckoutInput,
  InitCheckoutResult,
  VerifyResult,
  WebhookEvent,
  ChargeStatus,
} from "./types";

type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface PaystackOptions {
  secretKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

const toStatus = (s: unknown): ChargeStatus =>
  s === "success" ? "success" : s === "failed" ? "failed" : s === "pending" ? "pending" : "unknown";

/**
 * Paystack adapter (NGN-native). Uses the secret key server-side only.
 * - initCheckout  -> POST /transaction/initialize
 * - verifyTransaction -> GET /transaction/verify/:ref
 * - webhook signature -> HMAC-SHA512(rawBody, secretKey) == x-paystack-signature
 */
export function createPaystackProvider(opts: PaystackOptions): PaymentProvider {
  const baseUrl = opts.baseUrl ?? "https://api.paystack.co";
  const fetchImpl: FetchLike | undefined =
    opts.fetchImpl ?? (globalThis as { fetch?: FetchLike }).fetch;

  function ensureFetch(): FetchLike {
    if (!fetchImpl) throw new Error("paystack: no fetch implementation available");
    return fetchImpl;
  }

  return {
    id: "paystack",

    async initCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult> {
      const res = await ensureFetch()(`${baseUrl}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: input.email,
          amount: input.amountKobo,
          reference: input.reference,
          callback_url: input.callbackUrl,
          metadata: input.metadata ?? {},
        }),
      });
      if (!res.ok) throw new Error(`paystack init: HTTP ${res.status}`);
      const body = (await res.json()) as {
        status?: boolean;
        data?: { authorization_url?: string; reference?: string };
      };
      const url = body?.data?.authorization_url;
      if (!url) throw new Error("paystack init: no authorization_url");
      return { authorizationUrl: url, reference: body.data?.reference ?? input.reference };
    },

    async verifyTransaction(reference: string): Promise<VerifyResult> {
      const res = await ensureFetch()(`${baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${opts.secretKey}` },
      });
      if (!res.ok) throw new Error(`paystack verify: HTTP ${res.status}`);
      const body = (await res.json()) as {
        data?: { status?: string; amount?: number; reference?: string; metadata?: Record<string, unknown> };
      };
      return {
        status: toStatus(body?.data?.status),
        reference: body?.data?.reference ?? reference,
        amountKobo: body?.data?.amount,
        metadata: body?.data?.metadata,
      };
    },

    verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
      if (!signature) return false;
      const expected = createHmac("sha512", opts.secretKey).update(rawBody).digest("hex");
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    },

    parseWebhook(rawBody: string): WebhookEvent | null {
      try {
        const body = JSON.parse(rawBody) as {
          event?: string;
          data?: { reference?: string; status?: string; amount?: number; metadata?: Record<string, unknown> };
        };
        if (!body?.event || !body?.data?.reference) return null;
        return {
          type: body.event,
          reference: body.data.reference,
          status: toStatus(body.data.status),
          amountKobo: body.data.amount,
          metadata: body.data.metadata,
        };
      } catch {
        return null;
      }
    },
  };
}
