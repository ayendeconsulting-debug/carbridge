import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminActor } from "@/lib/admin-guard";
import { getVehicleForEdit } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

// Adds a clearing quote. Quotes accumulate (history); the detail view + cost
// engine always use the most recent (orderBy quotedAt desc, take 1).
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

  const costNGN = String(body.costNGN ?? "").trim();
  const agentName = String(body.agentName ?? "").trim();
  const quoteRef = body.quoteRef ? String(body.quoteRef).trim() : null;
  const validUntilRaw = body.validUntil ? String(body.validUntil).trim() : null;

  if (!(Number(costNGN) > 0)) {
    return Response.json({ error: "A positive clearing cost (NGN) is required" }, { status: 400 });
  }
  if (!agentName) {
    return Response.json({ error: "Agent name is required" }, { status: 400 });
  }
  let validUntil: Date | null = null;
  if (validUntilRaw) {
    const d = new Date(validUntilRaw);
    if (Number.isNaN(d.getTime())) {
      return Response.json({ error: "validUntil is not a valid date" }, { status: 400 });
    }
    validUntil = d;
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id }, select: { id: true } });
  if (!vehicle) return Response.json({ error: "Vehicle not found" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.clearingQuote.create({
        data: {
          vehicleId: id,
          costNGN: new Prisma.Decimal(costNGN),
          agentName,
          quoteRef,
          validUntil,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.actorId,
          entity: "Vehicle",
          entityId: id,
          action: "clearing.set",
          after: { costNGN, agentName, quoteRef, validUntil: validUntil?.toISOString() ?? null } as Prisma.InputJsonValue,
        },
      });
    });
  } catch {
    return Response.json({ error: "Could not save clearing quote" }, { status: 500 });
  }

  const fresh = await getVehicleForEdit(id);
  return Response.json(fresh);
}
