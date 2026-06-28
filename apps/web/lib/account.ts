import { prisma } from "./prisma";
import { getAuthContext } from "./auth";
import type {
  MyOfferView,
  MyReservationView,
  MySubscriptionView,
  MyCarRequestView,
  Currency,
} from "./types";
import type { ShippingMethod } from "@carbridge/shared";

/**
 * The current caller, now resolved through getAuthContext() (Clerk session or
 * dev-bypass demo user). Consumers (account page, respond route) are unchanged.
 */
export async function getCurrentUser(): Promise<{
  id: string;
  tier: string;
  email: string;
  name: string | null;
} | null> {
  const ctx = await getAuthContext();
  if (!ctx.userId) return null;
  return { id: ctx.userId, tier: ctx.tier, email: ctx.email ?? "", name: null };
}

const vehicleName = (year: number, make: string, model: string) =>
  `${year} ${make} ${model}`;

function snapshotTotal(snapshot: unknown): { ngn: string; cad: string } | null {
  const b = (snapshot as { breakdown?: { total?: { ngn?: unknown; cad?: unknown } } })?.breakdown?.total;
  if (b && typeof b.ngn === "string" && typeof b.cad === "string") {
    return { ngn: b.ngn, cad: b.cad };
  }
  return null;
}

function snapshotCounter(snapshot: unknown): { amount: string; currency: Currency } | null {
  const c = (snapshot as { counter?: { amount?: unknown; currency?: unknown } })?.counter;
  if (c && typeof c.amount === "string" && (c.currency === "CAD" || c.currency === "NGN")) {
    return { amount: c.amount, currency: c.currency };
  }
  return null;
}

export async function getMyOffers(userId: string): Promise<MyOfferView[]> {
  const now = Date.now();
  const rows = await prisma.offer.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: { select: { id: true, year: true, make: true, model: true } },
      rateLock: { select: { expiresAt: true } },
    },
  });

  return rows.map((o) => {
    const expiresAt = o.rateLock?.expiresAt ?? null;
    return {
      id: o.id,
      status: o.status,
      amount: o.amount.toString(),
      currency: o.currency as Currency,
      shippingMethod: o.shippingMethod as ShippingMethod,
      createdAt: o.createdAt.toISOString(),
      rateExpiresAt: expiresAt ? expiresAt.toISOString() : null,
      rateExpired: expiresAt ? expiresAt.getTime() < now : false,
      listedTotal: snapshotTotal(o.listingSnapshot),
      counter: snapshotCounter(o.listingSnapshot),
      canRespond: o.status === "COUNTERED",
      vehicle: { id: o.vehicle.id, name: vehicleName(o.vehicle.year, o.vehicle.make, o.vehicle.model) },
    };
  });
}

export async function getMyReservations(userId: string): Promise<MyReservationView[]> {
  const now = Date.now();
  const rows = await prisma.reservation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { vehicle: { select: { id: true, year: true, make: true, model: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    lockedTotalNGN: r.lockedTotalNGN.toString(),
    lockedTotalCAD: r.lockedTotalCAD.toString(),
    shippingMethod: r.shippingMethod as ShippingMethod,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    expired: r.expiresAt ? r.expiresAt.getTime() < now : false,
    vehicle: { id: r.vehicle.id, name: vehicleName(r.vehicle.year, r.vehicle.make, r.vehicle.model) },
  }));
}

export async function getMySubscription(userId: string): Promise<MySubscriptionView | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) return null;
  return {
    plan: sub.plan,
    status: sub.status,
    startedAt: sub.startedAt.toISOString(),
    expiresAt: sub.expiresAt.toISOString(),
  };
}

export async function getMyCarRequests(userId: string): Promise<MyCarRequestView[]> {
  const rows = await prisma.carRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      matchedVehicle: { select: { id: true, year: true, make: true, model: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    budget: { amount: r.budgetAmount.toString(), currency: r.budgetCurrency as Currency },
    wishlist: {
      make: r.make,
      model: r.model,
      yearMin: r.yearMin,
      yearMax: r.yearMax,
      bodyType: r.bodyType as string | null,
      maxMileageKm: r.maxMileageKm,
    },
    notes: r.notes,
    adminNote: r.adminNote,
    matched: r.matchedVehicle
      ? {
          id: r.matchedVehicle.id,
          name: `${r.matchedVehicle.year} ${r.matchedVehicle.make} ${r.matchedVehicle.model}`,
        }
      : null,
  }));
}
