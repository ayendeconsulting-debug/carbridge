import { prisma } from "./prisma";
import { getAuthContext } from "./auth";
import type {
  AdminOfferView,
  AdminReservationView,
  AdminCarRequestView,
  VehicleOption,
  CarWishlist,
  Currency,
} from "./types";
import type { ShippingMethod } from "@carbridge/shared";

/**
 * Admin check, now backed by getAuthContext(): Clerk publicMetadata role when
 * configured, else the dev-bypass cb_admin cookie. Every admin route calls this.
 */
export async function isAdmin(): Promise<boolean> {
  return (await getAuthContext()).isAdmin;
}

const vehicleName = (year: number, make: string, model: string) =>
  `${year} ${make} ${model}`;

/** Safely dig the frozen listed total out of an offer's listingSnapshot JSON. */
function snapshotTotal(
  snapshot: unknown,
): { ngn: string; cad: string } | null {
  if (snapshot && typeof snapshot === "object") {
    const breakdown = (snapshot as { breakdown?: unknown }).breakdown;
    if (breakdown && typeof breakdown === "object") {
      const total = (breakdown as { total?: unknown }).total;
      if (total && typeof total === "object") {
        const t = total as { ngn?: unknown; cad?: unknown };
        if (typeof t.ngn === "string" && typeof t.cad === "string") {
          return { ngn: t.ngn, cad: t.cad };
        }
      }
    }
  }
  return null;
}

function snapshotCounter(
  snapshot: unknown,
): { amount: string; currency: Currency } | null {
  if (snapshot && typeof snapshot === "object") {
    const counter = (snapshot as { counter?: unknown }).counter;
    if (counter && typeof counter === "object") {
      const c = counter as { amount?: unknown; currency?: unknown };
      if (typeof c.amount === "string" && (c.currency === "CAD" || c.currency === "NGN")) {
        return { amount: c.amount, currency: c.currency };
      }
    }
  }
  return null;
}

export async function listOffersForAdmin(): Promise<AdminOfferView[]> {
  const now = Date.now();
  const rows = await prisma.offer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: { select: { id: true, year: true, make: true, model: true } },
      user: { select: { email: true, name: true } },
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
      vehicle: {
        id: o.vehicle.id,
        name: vehicleName(o.vehicle.year, o.vehicle.make, o.vehicle.model),
      },
      buyer: { email: o.user.email, name: o.user.name },
    };
  });
}

export async function listReservationsForAdmin(): Promise<AdminReservationView[]> {
  const now = Date.now();
  const rows = await prisma.reservation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: { select: { id: true, year: true, make: true, model: true } },
      user: { select: { email: true, name: true } },
    },
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
    vehicle: {
      id: r.vehicle.id,
      name: vehicleName(r.vehicle.year, r.vehicle.make, r.vehicle.model),
    },
    buyer: { email: r.user.email, name: r.user.name },
  }));
}

const wishlistOf = (r: {
  make: string | null;
  model: string | null;
  yearMin: number | null;
  yearMax: number | null;
  bodyType: string | null;
  maxMileageKm: number | null;
}): CarWishlist => ({
  make: r.make,
  model: r.model,
  yearMin: r.yearMin,
  yearMax: r.yearMax,
  bodyType: r.bodyType,
  maxMileageKm: r.maxMileageKm,
});

export async function listCarRequestsForAdmin(): Promise<AdminCarRequestView[]> {
  const rows = await prisma.carRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, name: true } },
      matchedVehicle: { select: { id: true, year: true, make: true, model: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    buyer: { email: r.user.email, name: r.user.name },
    budget: { amount: r.budgetAmount.toString(), currency: r.budgetCurrency as Currency },
    wishlist: wishlistOf({
      make: r.make,
      model: r.model,
      yearMin: r.yearMin,
      yearMax: r.yearMax,
      bodyType: r.bodyType as string | null,
      maxMileageKm: r.maxMileageKm,
    }),
    notes: r.notes,
    adminNote: r.adminNote,
    matched: r.matchedVehicle
      ? { id: r.matchedVehicle.id, name: vehicleName(r.matchedVehicle.year, r.matchedVehicle.make, r.matchedVehicle.model) }
      : null,
  }));
}

/** AVAILABLE listings offered as match candidates in the admin picker. */
export async function listMatchableVehicles(): Promise<VehicleOption[]> {
  const rows = await prisma.vehicle.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, year: true, make: true, model: true },
  });
  return rows.map((v) => ({ id: v.id, name: vehicleName(v.year, v.make, v.model) }));
}
