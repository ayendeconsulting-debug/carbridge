import { fulfillSubscription, getSubscriptionByRef } from "@/lib/subscriptions";
import { selectPaymentProvider, getPlan } from "@/lib/payments";

export const dynamic = "force-dynamic";

// STUB ONLY. Simulates the provider redirecting the buyer back after a
// successful payment: fulfils the subscription, then forwards to the callback.
// Refuses to run unless the stub provider is active, so it can never be hit in
// a real-payment deployment.
export async function GET(req: Request) {
  if (selectPaymentProvider().id !== "stub") {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const reference = url.searchParams.get("reference");
  const userId = url.searchParams.get("userId");
  const cb = url.searchParams.get("cb");

  if (!reference || !userId || !cb) {
    return Response.json({ error: "missing reference/userId/cb" }, { status: 400 });
  }

  const already = await getSubscriptionByRef(reference);
  if (!already) {
    await fulfillSubscription({ userId, providerRef: reference, plan: getPlan().name });
  }

  const back = new URL(cb);
  back.searchParams.set("reference", reference);
  back.searchParams.set("stub", "1");
  return Response.redirect(back.toString(), 302);
}
