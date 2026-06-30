import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Expiry sweep - the mechanism behind the "wire the cron later" decision.
// Ready and manually testable now; not yet scheduled. When you're ready, enable
// the schedule in .github/workflows/reservation-sweep.yml.
//
// Reuses FX_REFRESH_SECRET (no extra secret to manage). It:
//   1. expires PENDING reservations past expiresAt and frees the vehicle,
//   2. expires SUBMITTED/COUNTERED offers whose rate lock has passed, and
//   3. expires ACTIVE subscriptions past expiresAt and downgrades the user
//      back to REGISTERED (SRD FR-SUB-03 auto-downgrade).
export async function POST(req: Request) {
  const secret = process.env.FX_REFRESH_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    // --- Reservations: expire + free the vehicle (only if still RESERVED) ---
    const stale = await prisma.reservation.findMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      select: { id: true, vehicleId: true },
    });

    let reservationsExpired = 0;
    let vehiclesFreed = 0;
    for (const r of stale) {
      await prisma.$transaction(async (tx) => {
        const upd = await tx.reservation.updateMany({
          where: { id: r.id, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        if (upd.count === 1) {
          reservationsExpired += 1;
          const freed = await tx.vehicle.updateMany({
            where: { id: r.vehicleId, status: "RESERVED" },
            data: { status: "AVAILABLE" },
          });
          vehiclesFreed += freed.count;
        }
      });
    }

    // --- Offers: expire those whose linked rate lock has passed ---
    const offersExpired = await prisma.offer.updateMany({
      where: {
        status: { in: ["SUBMITTED", "COUNTERED"] },
        rateLock: { expiresAt: { lt: now } },
      },
      data: { status: "EXPIRED" },
    });

    // --- Subscriptions: expire + downgrade the user (if no other active sub) ---
    const staleSubs = await prisma.subscription.findMany({
      where: { status: "ACTIVE", expiresAt: { lt: now } },
      select: { id: true, userId: true },
    });

    let subscriptionsExpired = 0;
    let usersDowngraded = 0;
    for (const s of staleSubs) {
      await prisma.$transaction(async (tx) => {
        const upd = await tx.subscription.updateMany({
          where: { id: s.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        if (upd.count === 1) {
          subscriptionsExpired += 1;
          const stillActive = await tx.subscription.count({
            where: { userId: s.userId, status: "ACTIVE" },
          });
          if (stillActive === 0) {
            const down = await tx.user.updateMany({
              where: { id: s.userId, tier: "PREMIUM" },
              data: { tier: "REGISTERED" },
            });
            usersDowngraded += down.count;
          }
        }
      });
    }

    return Response.json({
      ranAt: now.toISOString(),
      reservationsExpired,
      vehiclesFreed,
      offersExpired: offersExpired.count,
      subscriptionsExpired,
      usersDowngraded,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "sweep failed" },
      { status: 500 },
    );
  }
}
