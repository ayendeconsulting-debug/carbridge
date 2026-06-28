import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

type Action = "confirm" | "cancel";

// Admin response to a reservation. Guarded transitions; each writes an AuditLog
// and adjusts the vehicle status atomically.
//   confirm : PENDING            -> CONFIRMED, vehicle RESERVED -> SOLD
//   cancel  : PENDING|CONFIRMED  -> CANCELLED, vehicle -> AVAILABLE
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Admin required" }, { status: 403 });
  }
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const action = body.action as Action;

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    return Response.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (action === "confirm") {
    if (reservation.status !== "PENDING") {
      return Response.json(
        { error: `Cannot confirm a reservation that is ${reservation.status}` },
        { status: 409 },
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
      });
      await tx.vehicle.updateMany({
        where: { id: reservation.vehicleId, status: "RESERVED" },
        data: { status: "SOLD" },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          entity: "Reservation",
          entityId: id,
          action: "reservation.confirm",
          before: { status: reservation.status },
          after: { status: "CONFIRMED", vehicle: "SOLD" },
        },
      });
      return u;
    });
    return Response.json({ id: updated.id, status: updated.status });
  }

  if (action === "cancel") {
    if (reservation.status !== "PENDING" && reservation.status !== "CONFIRMED") {
      return Response.json(
        { error: `Cannot cancel a reservation that is ${reservation.status}` },
        { status: 409 },
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.reservation.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await tx.vehicle.updateMany({
        where: { id: reservation.vehicleId, status: { in: ["RESERVED", "SOLD"] } },
        data: { status: "AVAILABLE" },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          entity: "Reservation",
          entityId: id,
          action: "reservation.cancel",
          before: { status: reservation.status },
          after: { status: "CANCELLED", vehicle: "AVAILABLE" },
        },
      });
      return u;
    });
    return Response.json({ id: updated.id, status: updated.status });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
