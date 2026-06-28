import { Prisma } from "@prisma/client";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { adminActor } from "@/lib/admin-guard";
import { getVehicleForEdit } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const actor = await adminActor();
  if (!actor) return Response.json({ error: "Admin required" }, { status: 403 });
  const { id, photoId } = await params;

  const photo = await prisma.vehiclePhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.vehicleId !== id) {
    return Response.json({ error: "Photo not found" }, { status: 404 });
  }

  // Best-effort blob delete — never fail the DB delete if the object is already gone.
  try {
    await del(photo.url);
  } catch {
    // ignore
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehiclePhoto.delete({ where: { id: photoId } });

      // re-pack remaining positions to 0..n-1 (two-pass to dodge the unique index)
      const remaining = await tx.vehiclePhoto.findMany({
        where: { vehicleId: id },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      for (let i = 0; i < remaining.length; i++) {
        await tx.vehiclePhoto.update({
          where: { id: remaining[i]!.id },
          data: { position: -(i + 1) },
        });
      }
      for (let i = 0; i < remaining.length; i++) {
        await tx.vehiclePhoto.update({
          where: { id: remaining[i]!.id },
          data: { position: i },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.actorId,
          entity: "Vehicle",
          entityId: id,
          action: "photo.delete",
          after: { remaining: remaining.length } as Prisma.InputJsonValue,
        },
      });
    });
  } catch {
    return Response.json({ error: "Could not delete photo" }, { status: 500 });
  }

  const fresh = await getVehicleForEdit(id);
  return Response.json(fresh);
}
