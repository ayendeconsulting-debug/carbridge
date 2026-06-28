import { createRateLock } from "@carbridge/fx";
import type { ShippingMethod } from "@carbridge/shared";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { computeAuthoritativeLanded } from "@/lib/landed";

export const dynamic = "force-dynamic";

const METHODS: ShippingMethod[] = ["RORO", "CONTAINER"];

// Premium-gated Buy Now (reservation). Recompute the authoritative landed total,
// freeze it + a 72h rate lock, and move the vehicle AVAILABLE -> RESERVED
// atomically. The updateMany guard is an optimistic lock: if another buyer
// reserved first, 0 rows update and we return 409 instead of double-reserving.
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (ctx.tier !== "PREMIUM" || !ctx.userId) {
    return Response.json({ error: "Premium required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const vehicleId = String(body.vehicleId ?? "").trim();
  if (!vehicleId) {
    return Response.json({ error: "vehicleId is required" }, { status: 400 });
  }

  const method = body.method as ShippingMethod;
  if (!METHODS.includes(method)) {
    return Response.json({ error: "A valid shipping method is required" }, { status: 400 });
  }

  const landed = await computeAuthoritativeLanded(vehicleId, method);
  if (!landed) {
    return Response.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const userId = ctx.userId;

  const lock = createRateLock({
    pair: "CAD_NGN",
    rate: landed.fxRate,
    context: "RESERVATION",
  });

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // Optimistic lock: only succeeds while the vehicle is still AVAILABLE.
      const claimed = await tx.vehicle.updateMany({
        where: { id: vehicleId, status: "AVAILABLE" },
        data: { status: "RESERVED" },
      });
      if (claimed.count !== 1) {
        throw new Error("UNAVAILABLE");
      }

      const rateLock = await tx.rateLock.create({
        data: {
          userId,
          pair: "CAD_NGN",
          rate: lock.rate,
          context: "RESERVATION",
          expiresAt: lock.expiresAt,
        },
      });

      return tx.reservation.create({
        data: {
          vehicleId,
          userId,
          shippingMethod: method,
          lockedTotalCAD: landed.serialized.total.cad,
          lockedTotalNGN: landed.serialized.total.ngn,
          rateLockId: rateLock.id,
          status: "PENDING",
          expiresAt: lock.expiresAt,
        },
      });
    });

    return Response.json(
      {
        id: reservation.id,
        status: reservation.status,
        lockedTotal: {
          ngn: landed.serialized.total.ngn,
          cad: landed.serialized.total.cad,
        },
        rateLock: { rate: lock.rate, expiresAt: lock.expiresAt.toISOString() },
        expiresAt: lock.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "UNAVAILABLE") {
      return Response.json(
        { error: "This vehicle was just reserved by someone else" },
        { status: 409 },
      );
    }
    return Response.json({ error: "Could not complete the reservation" }, { status: 500 });
  }
}
