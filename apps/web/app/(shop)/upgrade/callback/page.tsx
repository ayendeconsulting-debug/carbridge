import Link from "next/link";
import { getSubscriptionByRef, fulfillSubscription } from "@/lib/subscriptions";
import { selectPaymentProvider, getPlan } from "@/lib/payments";
import { PremiumActivated } from "@/components/PremiumActivated";

export const dynamic = "force-dynamic";

export default async function UpgradeCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; stub?: string }>;
}) {
  const { reference } = await searchParams;

  let active = false;

  if (reference) {
    let sub = await getSubscriptionByRef(reference);

    // Real flow: the webhook may lag, so verify by reference and self-fulfil
    // (idempotent) rather than make the buyer wait.
    if (!sub) {
      try {
        const provider = selectPaymentProvider();
        const v = await provider.verifyTransaction(reference);
        const userId = v.metadata?.userId;
        if (v.status === "success" && typeof userId === "string" && userId) {
          await fulfillSubscription({ userId, providerRef: reference, plan: getPlan().name });
          sub = await getSubscriptionByRef(reference);
        }
      } catch {
        // fall through to "processing"
      }
    }

    active = sub?.status === "ACTIVE";
  }

  return (
    <div style={{ maxWidth: 460, margin: "70px auto 0", padding: "0 20px 80px" }}>
      {active ? (
        <PremiumActivated />
      ) : (
        <div style={{ textAlign: "center" }}>
          <h1 className="exp" style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Finishing up…</h1>
          <p style={{ color: "var(--steel)", lineHeight: 1.6, marginBottom: 22 }}>
            We haven&rsquo;t confirmed this payment yet. If you completed checkout, give it a moment and refresh.
          </p>
          <Link href={reference ? `/upgrade/callback?reference=${encodeURIComponent(reference)}` : "/upgrade"} className="btn btn-buy" style={{ display: "inline-block", textDecoration: "none" }}>Refresh</Link>
        </div>
      )}
    </div>
  );
}
