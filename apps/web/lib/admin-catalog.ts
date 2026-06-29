import { prisma } from "./prisma";
import type { ShippingMethod } from "@carbridge/shared";
import type {
  AdminVehicleListItem,
  AdminVehicleEdit,
  AdminShippingRow,
  AdminPhotoView,
} from "./types";

const vname = (year: number, make: string, model: string) =>
  `${year} ${make} ${model}`;

/** Every vehicle (all statuses) for the admin catalog list, with cover + counts. */
export async function listVehiclesForAdmin(): Promise<AdminVehicleListItem[]> {
  const rows = await prisma.vehicle.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      photos: { orderBy: { position: "asc" }, take: 1 },
      _count: { select: { shippingOptions: true, clearingQuotes: true, photos: true } },
    },
  });

  return rows.map((v) => ({
    id: v.id,
    name: vname(v.year, v.make, v.model),
    status: v.status,
    bodyType: v.bodyType,
    year: v.year,
    conditionGrade: v.conditionGrade,
    purchasePriceCAD: v.purchasePriceCAD.toString(),
    coverPhotoUrl: v.photos[0]?.url ?? null,
    photoCount: v._count.photos,
    shippingCount: v._count.shippingOptions,
    hasClearing: v._count.clearingQuotes > 0,
    updatedAt: v.updatedAt.toISOString(),
  }));
}

/** Full editable shape for one vehicle (core fields + shipping + latest clearing + history + photos). */
export async function getVehicleForEdit(
  id: string,
): Promise<AdminVehicleEdit | null> {
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { position: "asc" } },
      shippingOptions: { orderBy: { method: "asc" } },
      clearingQuotes: { orderBy: { quotedAt: "desc" }, take: 1 },
      historyReport: true,
    },
  });
  if (!v) return null;

  const photos: AdminPhotoView[] = v.photos.map((p) => ({
    id: p.id,
    url: p.url,
    position: p.position,
  }));

  const shippingOptions: AdminShippingRow[] = v.shippingOptions.map((o) => ({
    method: o.method as ShippingMethod,
    containerType: (o.containerType as "SHARED" | "SOLE" | null) ?? null,
    costCAD: o.costCAD.toString(),
    transitWeeksMin: o.transitWeeksMin,
    transitWeeksMax: o.transitWeeksMax,
  }));

  const c = v.clearingQuotes[0];

  return {
    id: v.id,
    make: v.make,
    model: v.model,
    year: v.year,
    trim: v.trim,
    bodyType: v.bodyType,
    mileageKm: v.mileageKm,
    conditionGrade: v.conditionGrade,
    transmission: v.transmission ?? null,
    fuelType: v.fuelType ?? null,
    colour: v.colour ?? null,
    vin: v.vin,
    description: v.description,
    purchasePriceCAD: v.purchasePriceCAD.toString(),
    defaultShippingMethod: v.defaultShippingMethod as ShippingMethod,
    handlingRateOverride: v.handlingRateOverride
      ? v.handlingRateOverride.toString()
      : null,
    status: v.status,
    photos,
    shippingOptions,
    clearing: c
      ? {
          costNGN: c.costNGN.toString(),
          agentName: c.agentName,
          quoteRef: c.quoteRef,
          quotedAt: c.quotedAt.toISOString(),
          validUntil: c.validUntil ? c.validUntil.toISOString() : null,
        }
      : null,
    history: v.historyReport
      ? {
          hasClaims: v.historyReport.hasClaims,
          summary: v.historyReport.summary,
          reportUrl: v.historyReport.reportUrl,
        }
      : null,
  };
}
