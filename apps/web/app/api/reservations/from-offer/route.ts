import { createRateLock } from "@carbridge/fx";
import { D } from "@carbridge/shared";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { getCurrentSnapshot } from "@/lib/fx";

export const dynamic = "force-dynamic";

// Premium-gated. Reserve a vehicle at the buyer's ACCEPTED offer price. The car
// is held ONLY on this click — a race-safe optimistic AVAILABLE->RESERVED lock,
// so if it sold first we return 409 instead of double-reserving. Links the
// reservation back to the offer (DB @unique enforces one reservation per offer)
// and freezes a fresh 72h rate lock at the agreed rate. From here the normal
// pipeline runs: quote -> buyer accepts -> invoice -> pay.
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (ctx.tier !== "PREMIUM" || !ctx.userId) {
    return Response.json({ error: "Premium required" }, { status: 403 });
  }
  const userId = ctx.userId;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const offerId = String(body.offerId ?? "").trim();
  if (!offerId) return Response.json({ error: "offerId is required" }, { status: 400 });

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { rateLock: true, reservation: { select: { id: true } } },
  });
  if (!offer) return Response.json({ error: "Offer not found" }, { status: 404 });
  if (offer.userId !== userId) return Response.json({ error: "Not your offer" }, { status: 403 });
  if (offer.status !== "ACCEPTED") {
    return Response.json({ error: "Only an accepted offer can be reserved" }, { status: 409 });
  }
  if (offer.reservation) {
    return Response.json({ error: "You've already reserved this offer" }, { status: 409 });
  }

  // Agreed price = the counter if the deal closed on one, else the original offer.
  const snap = offer.listingSnapshot as { counter?: { amount?: string; currency?: string } } | null;
  const counter = snap?.counter;
  const agreedAmount =
    counter && typeof counter.amount === "string" ? counter.amount : offer.amount.toString();
  const agreedCurrency =
    counter && (counter.currency === "CAD" || counter.currency === "NGN")
      ? counter.currency
      : (offer.currency as "NGN" | "CAD");

  // Derive both currencies from the single agreed amount via the agreed rate.
  const rate = offer.rateLock?.rate.toString() ?? (await getCurrentSnapshot()).effectiveRate;
  const r = D(rate);
  const ngn = agreedCurrency === "NGN" ? D(agreedAmount) : D(agreedAmount).times(r);
  const cad = agreedCurrency === "CAD" ? D(agreedAmount) : D(agreedAmount).div(r);
  const lockedTotalNGN = ngn.toFixed(2);
  const lockedTotalCAD = cad.toFixed(2);

  const lock = createRateLock({ pair: "CAD_NGN", rate, context: "RESERVATION" });

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // Optimistic lock: only succeeds while the vehicle is still AVAILABLE.
      const claimed = await tx.vehicle.updateMany({
        where: { id: offer.vehicleId, status: "AVAILABLE" },
        data: { status: "RESERVED" },
      });
      if (claimed.count !== 1) throw new Error("UNAVAILABLE");

      const rateLock = await tx.rateLock.create({
        data: {
          userId,
          pair: "CAD_NGN",
          rate: lock.rate,
          context: "RESERVATION",
          expiresAt: lock.expiresAt,
        },
      });

      const created = await tx.reservation.create({
        data: {
          vehicleId: offer.vehicleId,
          userId,
          shippingMethod: offer.shippingMethod,
          lockedTotalCAD,
          lockedTotalNGN,
          rateLockId: rateLock.id,
          offerId: offer.id,
          status: "PENDING",
          expiresAt: lock.expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          entity: "Reservation",
          entityId: created.id,
          action: "reservation.from_offer",
          before: { offerId: offer.id, offerStatus: offer.status },
          after: { lockedTotalNGN, lockedTotalCAD, agreedCurrency },
        },
      });

      return created;
    });

    return Response.json(
      {
        id: reservation.id,
        status: reservation.status,
        lockedTotal: { ngn: lockedTotalNGN, cad: lockedTotalCAD },
        expiresAt: lock.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "UNAVAILABLE") {
      return Response.json(
        { error: "This vehicle is no longer available" },
        { status: 409 },
      );
    }
    return Response.json({ error: "Could not complete the reservation" }, { status: 500 });
  }
}
