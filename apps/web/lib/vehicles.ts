import { prisma } from "./prisma";
import type {
  VehicleCardView,
  VehicleDetailView,
  ShippingOptionView,
  PhotoView,
} from "./types";
import type { ShippingMethod } from "@carbridge/shared";

const etaLabel = (min: number, max: number) => `${min}–${max} wk`;

// Loose row typing keeps this file independent of the generated Prisma types
// at author-time; the real shapes are enforced by `prisma generate` + next build.
type Row = Awaited<ReturnType<typeof fetchVehicles>>[number];

function fetchVehicles() {
  return prisma.vehicle.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { createdAt: "desc" },
    include: {
      shippingOptions: true,
      clearingQuotes: { orderBy: { quotedAt: "desc" }, take: 1 },
      historyReport: true,
      photos: { orderBy: { position: "asc" }, take: 1 },
    },
  });
}

function defaultShipping(row: Row): {
  method: ShippingMethod;
  cost: string;
  min: number;
  max: number;
} {
  const opt =
    row.shippingOptions.find((o) => o.method === row.defaultShippingMethod) ??
    row.shippingOptions[0];
  return {
    method: (row.defaultShippingMethod as ShippingMethod) ?? "RORO",
    cost: opt ? opt.costCAD.toString() : "0",
    min: opt ? opt.transitWeeksMin : 0,
    max: opt ? opt.transitWeeksMax : 0,
  };
}

function toCard(row: Row): VehicleCardView {
  const ship = defaultShipping(row);
  const clearing = row.clearingQuotes[0];
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    trim: row.trim,
    bodyType: row.bodyType,
    mileageKm: row.mileageKm,
    conditionGrade: row.conditionGrade,
    transmission: row.transmission ?? null,
    fuelType: row.fuelType ?? null,
    hasClaims: row.historyReport?.hasClaims ?? false,
    etaLabel: etaLabel(ship.min, ship.max),
    coverPhotoUrl: row.photos[0]?.url ?? null,
    purchasePriceCAD: row.purchasePriceCAD.toString(),
    defaultShippingMethod: ship.method,
    defaultShippingCostCAD: ship.cost,
    clearingCostNGN: clearing ? clearing.costNGN.toString() : "0",
    handlingRate: row.handlingRateOverride ? row.handlingRateOverride.toString() : null,
  };
}

export async function getVehicleCards(): Promise<VehicleCardView[]> {
  const rows = await fetchVehicles();
  return rows.map(toCard);
}

export async function getVehicleDetail(
  id: string,
): Promise<VehicleDetailView | null> {
  const row = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      shippingOptions: { orderBy: { method: "asc" } },
      clearingQuotes: { orderBy: { quotedAt: "desc" }, take: 1 },
      historyReport: true,
      photos: { orderBy: { position: "asc" } },
    },
  });
  if (!row) return null;

  const shippingOptions: ShippingOptionView[] = row.shippingOptions.map((o) => ({
    method: o.method as ShippingMethod,
    containerType: (o.containerType as "SHARED" | "SOLE" | null) ?? null,
    costCAD: o.costCAD.toString(),
    transitWeeksMin: o.transitWeeksMin,
    transitWeeksMax: o.transitWeeksMax,
  }));
  const photos: PhotoView[] = row.photos.map((p) => ({
    id: p.id,
    url: p.url,
    position: p.position,
  }));
  const ship = defaultShipping(row);
  const clearing = row.clearingQuotes[0];

  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    trim: row.trim,
    bodyType: row.bodyType,
    mileageKm: row.mileageKm,
    conditionGrade: row.conditionGrade,
    transmission: row.transmission ?? null,
    fuelType: row.fuelType ?? null,
    hasClaims: row.historyReport?.hasClaims ?? false,
    etaLabel: etaLabel(ship.min, ship.max),
    coverPhotoUrl: row.photos[0]?.url ?? null,
    purchasePriceCAD: row.purchasePriceCAD.toString(),
    defaultShippingMethod: ship.method,
    defaultShippingCostCAD: ship.cost,
    clearingCostNGN: clearing ? clearing.costNGN.toString() : "0",
    handlingRate: row.handlingRateOverride ? row.handlingRateOverride.toString() : null,
    vin: row.vin,
    colour: row.colour ?? null,
    description: row.description,
    photos,
    shippingOptions,
    clearing: clearing
      ? {
          costNGN: clearing.costNGN.toString(),
          agentName: clearing.agentName,
          validUntil: clearing.validUntil ? clearing.validUntil.toISOString() : null,
        }
      : null,
    history: row.historyReport
      ? { hasClaims: row.historyReport.hasClaims, summary: row.historyReport.summary }
      : null,
  };
}

/** Resolve the demo user for the current stub tier (replace with Clerk). */
export async function getDemoUserId(premium: boolean): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { tier: premium ? "PREMIUM" : "REGISTERED" },
    select: { id: true },
  });
  return user?.id ?? null;
}
