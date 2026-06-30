import { getAuthContext } from "@/lib/auth";
import { getMembershipPrice } from "@/lib/settings";
import { issueOrReuseMembershipInvoice } from "@/lib/invoicing";

export const dynamic = "force-dynamic";

// POST /api/memberships/request - self-serve Premium. Issues (or reuses) a
// membership invoice for the signed-in buyer at the published price. Payment is
// off-platform (bank transfer); an admin records it, which grants Premium.
// No payment gateway, no self-activation.
export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx.userId) {
    return Response.json({ error: "Please sign in to upgrade." }, { status: 401 });
  }
  if (ctx.tier === "PREMIUM") {
    return Response.json({ alreadyPremium: true }, { status: 200 });
  }

  const price = getMembershipPrice();
  if (!price.configured) {
    return Response.json(
      { error: "Membership isn't available to purchase right now - please check back soon." },
      { status: 503 },
    );
  }

  const r = await issueOrReuseMembershipInvoice(ctx.userId, price.amountNGN, ctx.userId);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ invoiceId: r.invoiceId, number: r.number, reused: r.reused }, { status: 201 });
}
