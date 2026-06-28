import { Prisma, type ShippingMethod, type ContainerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminActor } from "@/lib/admin-guard";
import { getVehicleForEdit } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

const METHODS = ["RORO", "CONTAINER"];
const CONTAINERS = ["SHARED", "SOLE"];

interface RowInput {
  method: string;
  containerType: string | null;
  costCAD: string;
  transitWeeksMin: number;
  transitWeeksMax: number;
}

// Replace-the-whole-set semantics: submit the full list of options each save.
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

  const raw = Array.isArray(body.options) ? (body.options as unknown[]) : null;
  if (!raw || raw.length === 0) {
    return Response.json({ error: "At least one shipping option is required" }, { status: 400 });
  }

  const rows: RowInput[] = [];
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>;
    const method = String(o.method ?? "");
    if (!METHODS.includes(method)) {
      return Response.json({ error: `Invalid shipping method: ${method}` }, { status: 400 });
    }
    let containerType: string | null = null;
    if (method === "CONTAINER") {
      const ct = o.containerType ? String(o.containerType) : null;
      if (ct !== null && !CONTAINERS.includes(ct)) {
        return Response.json({ error: "Container type must be SHARED or SOLE" }, { status: 400 });
      }
      containerType = ct;
    }
    const costCAD = String(o.costCAD ?? "").trim();
    if (!(Number(costCAD) > 0)) {
      return Response.json({ error: "Each shipping cost must be a positive number" }, { status: 400 });
    }
    const min = Number(o.transitWeeksMin);
    const max = Number(o.transitWeeksMax);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) {
      return Response.json(
        { error: "Transit weeks must be whole numbers with min ≤ max" },
        { status: 400 },
      );
    }
    rows.push({ method, containerType, costCAD, transitWeeksMin: min, transitWeeksMax: max });
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: { id: true, defaultShippingMethod: true },
  });
  if (!vehicle) return Response.json({ error: "Vehicle not found" }, { status: 404 });

  // If the current default method is no longer offered, fall back to the first row.
  const methodsOffered = new Set(rows.map((r) => r.method));
  const nextDefault = methodsOffered.has(vehicle.defaultShippingMethod)
    ? vehicle.defaultShippingMethod
    : (rows[0]!.method as ShippingMethod);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.shippingOption.deleteMany({ where: { vehicleId: id } });
      await tx.shippingOption.createMany({
        data: rows.map((r) => ({
          vehicleId: id,
          method: r.method as ShippingMethod,
          containerType: (r.containerType as ContainerType | null) ?? null,
          costCAD: new Prisma.Decimal(r.costCAD),
          transitWeeksMin: r.transitWeeksMin,
          transitWeeksMax: r.transitWeeksMax,
        })),
      });
      if (nextDefault !== vehicle.defaultShippingMethod) {
        await tx.vehicle.update({
          where: { id },
          data: { defaultShippingMethod: nextDefault as ShippingMethod },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.actorId,
          entity: "Vehicle",
          entityId: id,
          action: "shipping.set",
          after: { count: rows.length, defaultShippingMethod: nextDefault } as Prisma.InputJsonValue,
        },
      });
    });
  } catch {
    return Response.json({ error: "Could not save shipping options" }, { status: 500 });
  }

  const fresh = await getVehicleForEdit(id);
  return Response.json(fresh);
}
