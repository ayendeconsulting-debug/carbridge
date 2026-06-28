import { createRateLock } from "@carbridge/fx";
import type { ShippingMethod } from "@carbridge/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { computeAuthoritativeLanded } from "@/lib/landed";

export const dynamic = "force-dynamic";

const METHODS: ShippingMethod[] = ["RORO", "CONTAINER"];

// Premium-gated. A buyer offers on the total landed cost (NGN or CAD). We
// recompute the authoritative landed figure server-side, capture a 72h rate
// lock, and freeze the full breakdown into listingSnapshot.
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

  const amount = String(body.amount ?? "").trim();
  if (!amount || !(Number(amount) > 0)) {
    return Response.json({ error: "A positive offer amount is required" }, { status: 400 });
  }
  const currency = body.currency === "CAD" ? "CAD" : "NGN";

  // Authoritative recompute (FR-CST-05) — also confirms the vehicle exists and
  // the method is actually offered for it.
  const landed = await computeAuthoritativeLanded(vehicleId, method);
  if (!landed) {
    return Response.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const status = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { status: true },
  });
  if (status?.status !== "AVAILABLE") {
    return Response.json(
      { error: "This vehicle is no longer available for offers" },
      { status: 409 },
    );
  }

  const userId = ctx.userId;

  const lock = createRateLock({
    pair: "CAD_NGN",
    rate: landed.fxRate,
    context: "OFFER",
  });

  const created = await prisma.$transaction(async (tx) => {
    const rateLock = await tx.rateLock.create({
      data: {
        userId,
        pair: "CAD_NGN",
        rate: lock.rate,
        context: "OFFER",
        expiresAt: lock.expiresAt,
      },
    });

    return tx.offer.create({
      data: {
        vehicleId,
        userId,
        amount,
        currency,
        shippingMethod: method,
        rateLockId: rateLock.id,
        listingSnapshot: {
          method,
          fxRate: landed.fxRate,
          inputs: {
            purchasePriceCAD: landed.vehicle.purchasePriceCAD,
            shippingCostCAD: landed.shippingCostCAD,
            clearingCostNGN: landed.vehicle.clearingCostNGN,
            handlingRate: landed.vehicle.handlingRate,
          },
          breakdown: landed.serialized,
        } as unknown as Prisma.InputJsonValue,
        status: "SUBMITTED",
      },
    });
  });

  return Response.json(
    {
      id: created.id,
      status: created.status,
      amount,
      currency,
      rateLock: { rate: lock.rate, expiresAt: lock.expiresAt.toISOString() },
      listedTotal: {
        ngn: landed.serialized.total.ngn,
        cad: landed.serialized.total.cad,
      },
    },
    { status: 201 },
  );
}
