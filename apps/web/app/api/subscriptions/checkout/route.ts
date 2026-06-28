import { randomBytes } from "node:crypto";
import { getAuthContext } from "@/lib/auth";
import { selectPaymentProvider, getPlan } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Starts a Premium subscription checkout for the current user. Resolves identity
// via getAuthContext (Clerk session or dev-bypass), initialises the provider,
// and returns a URL for the client to redirect to (Paystack, or the stub).
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx.userId) {
    return Response.json({ error: "Sign in to subscribe" }, { status: 401 });
  }
  if (ctx.tier === "PREMIUM") {
    return Response.json({ alreadyPremium: true });
  }
  const email = ctx.email && ctx.email.length > 0 ? ctx.email : `${ctx.userId}@carbridge.local`;

  const plan = getPlan();
  const reference = `cb_sub_${randomBytes(10).toString("hex")}`;
  const origin = new URL(req.url).origin;
  const callbackUrl = `${origin}/upgrade/callback`;

  try {
    const provider = selectPaymentProvider();
    const result = await provider.initCheckout({
      email,
      amountKobo: plan.amountKobo,
      reference,
      callbackUrl,
      metadata: { userId: ctx.userId, plan: plan.name },
    });
    return Response.json({
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "checkout failed" },
      { status: 502 },
    );
  }
}
