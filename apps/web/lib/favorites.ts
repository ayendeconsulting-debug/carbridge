import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { computeAuthoritativeLanded } from "./landed";
import type { WatchingItemView } from "./types";

/**
 * A favorite IS a watch. Saving snapshots the vehicle's figures at that moment;
 * the Watching list recomputes live and diffs against the snapshot to surface
 * price / FX / availability changes - all at read time, no background job.
 */
interface WatchSnapshot {
  totalNGN: string;
  totalCAD: string;
  fxRate: string;
  purchasePriceCAD: string;
  status: string;
  savedAt: string;
}

async function buildSnapshot(vehicleId: string): Promise<WatchSnapshot | null> {
  const landed = await computeAuthoritativeLanded(vehicleId);
  if (!landed) return null;
  const v = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { status: true, purchasePriceCAD: true },
  });
  if (!v) return null;
  return {
    totalNGN: landed.serialized.total.ngn,
    totalCAD: landed.serialized.total.cad,
    fxRate: landed.fxRate,
    purchasePriceCAD: v.purchasePriceCAD.toString(),
    status: v.status,
    savedAt: new Date().toISOString(),
  };
}

/** Toggle a favorite on/off. Adding freezes a fresh snapshot. Idempotent. */
export async function toggleFavorite(
  userId: string,
  vehicleId: string,
): Promise<{ favorited: boolean }> {
  const existing = await prisma.favorite.findUnique({
    where: { userId_vehicleId: { userId, vehicleId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  const snapshot = await buildSnapshot(vehicleId);
  await prisma.favorite.create({
    data: {
      userId,
      vehicleId,
      snapshot: (snapshot ?? undefined) as unknown as Prisma.InputJsonValue,
    },
  });
  return { favorited: true };
}

/** Vehicle ids the user has saved (for filling hearts in gallery/detail). */
export async function getFavoriteVehicleIds(userId: string): Promise<string[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { vehicleId: true },
  });
  return rows.map((r) => r.vehicleId);
}

export async function isFavorited(userId: string, vehicleId: string): Promise<boolean> {
  const row = await prisma.favorite.findUnique({
    where: { userId_vehicleId: { userId, vehicleId } },
    select: { id: true },
  });
  return !!row;
}

function asSnapshot(raw: unknown): WatchSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  const totalNGN = s(o.totalNGN);
  const totalCAD = s(o.totalCAD);
  if (!totalNGN || !totalCAD) return null;
  return {
    totalNGN,
    totalCAD,
    fxRate: s(o.fxRate) ?? "0",
    purchasePriceCAD: s(o.purchasePriceCAD) ?? "0",
    status: s(o.status) ?? "AVAILABLE",
    savedAt: s(o.savedAt) ?? new Date(0).toISOString(),
  };
}

const STATUS_LABEL: Record<string, string> = {
  SOLD: "Sold",
  RESERVED: "Reserved by someone",
  ARCHIVED: "Withdrawn from sale",
  DRAFT: "Temporarily unlisted",
};

/**
 * The Watching list: each saved vehicle recomputed live and diffed against its
 * save-time snapshot. `available` drives whether action is still possible; the
 * change fields are null when nothing moved.
 */
export async function getWatching(userId: string): Promise<WatchingItemView[]> {
  const favs = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: { select: { id: true, year: true, make: true, model: true, status: true } },
    },
  });

  const out: WatchingItemView[] = [];
  for (const f of favs) {
    const v = f.vehicle;
    const name = `${v.year} ${v.make} ${v.model}`;
    const snap = asSnapshot(f.snapshot);
    const landed = await computeAuthoritativeLanded(v.id);

    // Vehicle gone or uncomputable - surface as unavailable, no figures.
    if (!landed) {
      out.push({
        vehicleId: v.id,
        name,
        coverPhotoUrl: null,
        savedAt: snap?.savedAt ?? f.createdAt.toISOString(),
        available: false,
        statusNote: STATUS_LABEL[v.status] ?? "No longer listed",
        current: null,
        savedTotal: snap ? { ngn: snap.totalNGN, cad: snap.totalCAD } : null,
        priceDropCAD: null,
        priceUpCAD: null,
        fxMoved: false,
      });
      continue;
    }

    const curNGN = landed.serialized.total.ngn;
    const curCAD = landed.serialized.total.cad;
    const available = v.status === "AVAILABLE";
    const statusNote = available ? null : STATUS_LABEL[v.status] ?? v.status;

    let priceDropCAD: string | null = null;
    let priceUpCAD: string | null = null;
    let fxMoved = false;
    if (snap) {
      const dPrice = Number(landed.vehicle.purchasePriceCAD) - Number(snap.purchasePriceCAD);
      if (dPrice < -0.5) priceDropCAD = Math.abs(dPrice).toFixed(2);
      else if (dPrice > 0.5) priceUpCAD = dPrice.toFixed(2);
      // FX considered "moved" if the NGN total shifted >1% with no price change.
      const dTotal = Number(curNGN) - Number(snap.totalNGN);
      const pct = Number(snap.totalNGN) > 0 ? Math.abs(dTotal) / Number(snap.totalNGN) : 0;
      fxMoved = !priceDropCAD && !priceUpCAD && pct > 0.01;
    }

    out.push({
      vehicleId: v.id,
      name,
      coverPhotoUrl: landed.vehicle.coverPhotoUrl ?? null,
      savedAt: snap?.savedAt ?? f.createdAt.toISOString(),
      available,
      statusNote,
      current: { ngn: curNGN, cad: curCAD },
      savedTotal: snap ? { ngn: snap.totalNGN, cad: snap.totalCAD } : null,
      priceDropCAD,
      priceUpCAD,
      fxMoved,
    });
  }
  return out;
}
