import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { sendRequestMatchedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type Action = "acknowledge" | "match" | "decline";

// Admin response to a Source-a-Car request. Guarded transitions; each audited.
//   acknowledge : SUBMITTED -> IN_REVIEW (buyer sees we're on it)
//   match       : SUBMITTED|IN_REVIEW -> MATCHED (links a vehicle + optional note)
//   decline     : SUBMITTED|IN_REVIEW|MATCHED -> DECLINED (+ optional note)
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
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  const request = await prisma.carRequest.findUnique({ where: { id } });
  if (!request) return Response.json({ error: "Request not found" }, { status: 404 });

  if (action === "acknowledge") {
    if (request.status !== "SUBMITTED") {
      return Response.json(
        { error: `Cannot acknowledge a request that is ${request.status}` },
        { status: 409 },
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.carRequest.update({
        where: { id },
        data: { status: "IN_REVIEW" },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          entity: "CarRequest",
          entityId: id,
          action: "carRequest.acknowledge",
          before: { status: request.status },
          after: { status: "IN_REVIEW" },
        },
      });
      return u;
    });
    return Response.json({ id: updated.id, status: updated.status });
  }

  if (action === "match") {
    if (request.status !== "SUBMITTED" && request.status !== "IN_REVIEW") {
      return Response.json(
        { error: `Cannot match a request that is ${request.status}` },
        { status: 409 },
      );
    }
    const vehicleId = String(body.vehicleId ?? "").trim();
    if (!vehicleId) {
      return Response.json({ error: "Pick a vehicle to match" }, { status: 400 });
    }
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, year: true, make: true, model: true },
    });
    if (!vehicle) {
      return Response.json({ error: "That vehicle no longer exists" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.carRequest.update({
        where: { id },
        data: { status: "MATCHED", matchedVehicleId: vehicleId, adminNote: note },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          entity: "CarRequest",
          entityId: id,
          action: "carRequest.match",
          before: { status: request.status },
          after: { status: "MATCHED", matchedVehicleId: vehicleId },
        },
      });
      return u;
    });

    // Best-effort buyer notification (never throws; mirrors the other sends).
    await sendRequestMatchedEmail({
      userId: request.userId,
      vehicleId: vehicle.id,
      vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      adminNote: note,
    });

    return Response.json({ id: updated.id, status: updated.status, matchedVehicleId: vehicleId });
  }

  if (action === "decline") {
    if (!["SUBMITTED", "IN_REVIEW", "MATCHED"].includes(request.status)) {
      return Response.json(
        { error: `Cannot decline a request that is ${request.status}` },
        { status: 409 },
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.carRequest.update({
        where: { id },
        data: { status: "DECLINED", adminNote: note },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          entity: "CarRequest",
          entityId: id,
          action: "carRequest.decline",
          before: { status: request.status },
          after: { status: "DECLINED" },
        },
      });
      return u;
    });
    return Response.json({ id: updated.id, status: updated.status });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
