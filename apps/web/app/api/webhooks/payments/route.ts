import { selectPaymentProvider, getPlan } from "@/lib/payments";
import { fulfillSubscription } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

// Paystack webhook. Verifies the x-paystack-signature HMAC against the raw body,
// then fulfils on charge.success. Always 200s for verified-but-irrelevant events
// so the provider doesn't retry. The reference is the idempotency key.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const provider = selectPaymentProvider();
  const signature = req.headers.get("x-paystack-signature");

  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = provider.parseWebhook(rawBody);
  if (!event || event.type !== "charge.success" || event.status !== "success") {
    return Response.json({ received: true });
  }

  const userId = event.metadata?.userId;
  if (typeof userId !== "string" || !userId) {
    // Nothing we can attribute this to — ack so it isn't retried forever.
    return Response.json({ received: true, fulfilled: false });
  }

  await fulfillSubscription({
    userId,
    providerRef: event.reference,
    plan: getPlan().name,
  });

  return Response.json({ received: true, fulfilled: true });
}
