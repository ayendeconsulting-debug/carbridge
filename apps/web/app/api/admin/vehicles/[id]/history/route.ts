import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminActor } from "@/lib/admin-guard";
import { getVehicleForEdit } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

// Upserts the single HistoryReport (vehicleId is @unique).
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await adminActor();
  if (!actor) return Response.json({ error: "Admin required" }, { status: 403 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const hasClaims = body.hasClaims === true || body.hasClaims === "true";
  const summary = body.summary ? String(body.summary).trim() : null;
  const reportUrl = body.reportUrl ? String(body.reportUrl).trim() : null;

  if (reportUrl && !/^https?:\/\//i.test(reportUrl)) {
    return Response.json({ error: "Report URL must start with http(s)://" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id }, select: { id: true } });
  if (!vehicle) return Response.json({ error: "Vehicle not found" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.historyReport.upsert({
        where: { vehicleId: id },
        create: { vehicleId: id, hasClaims, summary, reportUrl },
        update: { hasClaims, summary, reportUrl },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.actorId,
          entity: "Vehicle",
          entityId: id,
          action: "history.set",
          after: { hasClaims, hasSummary: !!summary, hasReportUrl: !!reportUrl } as Prisma.InputJsonValue,
        },
      });
    });
  } catch {
    return Response.json({ error: "Could not save history report" }, { status: 500 });
  }

  const fresh = await getVehicleForEdit(id);
  return Response.json(fresh);
}
