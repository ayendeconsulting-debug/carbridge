import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/account";
import { sendOfferAcceptedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type Action = "accept" | "decline";

// Buyer responds to an admin counter on their own offer.
//   accept  : COUNTERED -> ACCEPTED
//   decline : COUNTERED -> DECLINED
// Owner-gated: the offer must belong to the current user.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "No demo user — run the seed" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const action = body.action as Action;
  if (action !== "accept" && action !== "decline") {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) return Response.json({ error: "Offer not found" }, { status: 404 });
  if (offer.userId !== user.id) {
    return Response.json({ error: "Not your offer" }, { status: 403 });
  }
  if (offer.status !== "COUNTERED") {
    return Response.json(
      { error: "There's no counter to respond to on this offer" },
      { status: 409 },
    );
  }

  const next = action === "accept" ? "ACCEPTED" : "DECLINED";
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.offer.update({ where: { id }, data: { status: next } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        entity: "Offer",
        entityId: id,
        action: `offer.buyer.${action}`,
        before: { status: offer.status },
        after: { status: next },
      },
    });
    return u;
  });

  if (next === "ACCEPTED") {
    // Best-effort: confirm + nudge the buyer to reserve at the agreed (counter) price.
    const snap = offer.listingSnapshot as { counter?: { amount?: string; currency?: string } } | null;
    const counter = snap?.counter;
    const agreedAmount =
      counter && typeof counter.amount === "string" ? counter.amount : offer.amount.toString();
    const agreedCurrency =
      counter && (counter.currency === "CAD" || counter.currency === "NGN")
        ? counter.currency
        : (offer.currency as "NGN" | "CAD");
    const v = await prisma.vehicle.findUnique({
      where: { id: offer.vehicleId },
      select: { year: true, make: true, model: true },
    });
    await sendOfferAcceptedEmail({
      userId: offer.userId,
      vehicleName: v ? `${v.year} ${v.make} ${v.model}` : "your vehicle",
      agreedAmount,
      agreedCurrency,
    });
  }

  return Response.json({ id: updated.id, status: updated.status });
}
