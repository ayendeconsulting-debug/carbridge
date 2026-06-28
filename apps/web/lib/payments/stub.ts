import type {
  PaymentProvider,
  InitCheckoutInput,
  InitCheckoutResult,
  VerifyResult,
  WebhookEvent,
} from "./types";

/**
 * DEV-ONLY provider. No network, no keys. initCheckout points the buyer at a
 * local /api/subscriptions/dev-complete route that fulfils the subscription and
 * redirects to the callback — simulating a successful hosted checkout so the
 * whole upgrade flow is demoable on localhost. The sibling of createFixedProvider
 * in the FX module. NEVER selected when a real PAYSTACK_SECRET_KEY is set unless
 * PAYMENTS_DEV_STUB=1 is forced.
 */
export function createStubProvider(): PaymentProvider {
  return {
    id: "stub",

    async initCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult> {
      const origin = new URL(input.callbackUrl).origin;
      const url = new URL(`${origin}/api/subscriptions/dev-complete`);
      url.searchParams.set("reference", input.reference);
      url.searchParams.set("amount", String(input.amountKobo));
      url.searchParams.set("cb", input.callbackUrl);
      const userId = input.metadata?.userId;
      if (userId !== undefined) url.searchParams.set("userId", String(userId));
      return { authorizationUrl: url.toString(), reference: input.reference };
    },

    async verifyTransaction(reference: string): Promise<VerifyResult> {
      // The stub always reports success — fulfilment already happened in
      // dev-complete before the redirect.
      return { status: "success", reference };
    },

    verifyWebhookSignature(): boolean {
      return false; // stub never receives real webhooks
    },

    parseWebhook(): WebhookEvent | null {
      return null;
    },
  };
}
