import { Prisma, type BodyType, type ShippingMethod, type VehicleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminActor } from "@/lib/admin-guard";
import { getVehicleForEdit } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

const BODY_TYPES = [
  "SUV", "SEDAN", "HATCHBACK", "WAGON", "COUPE", "TRUCK", "VAN", "OTHER",
];
const METHODS = ["RORO", "CONTAINER"];

// Admin-only status transitions. RESERVED / SOLD are commerce-driven and never
// set here. Publishing (DRAFT -> AVAILABLE) is gated on shipping + clearing.
const ALLOWED: Record<string, string[]> = {
  DRAFT: ["AVAILABLE", "ARCHIVED"],
  AVAILABLE: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
  RESERVED: [],
  SOLD: [],
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await adminActor();
  if (!actor) return Response.json({ error: "Admin required" }, { status: 403 });
  const { id } = await params;
  const v = await getVehicleForEdit(id);
  if (!v) return Response.json({ error: "Vehicle not found" }, { status: 404 });
  return Response.json(v);
}

export async function PATCH(
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

  const current = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      _count: { select: { shippingOptions: true, clearingQuotes: true } },
    },
  });
  if (!current) return Response.json({ error: "Vehicle not found" }, { status: 404 });

  const data: Prisma.VehicleUpdateInput = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);

  // ---- core field edits (only those provided) ----
  if (has("make")) {
    const make = String(body.make ?? "").trim();
    if (!make) return Response.json({ error: "Make cannot be empty" }, { status: 400 });
    data.make = make;
  }
  if (has("model")) {
    const model = String(body.model ?? "").trim();
    if (!model) return Response.json({ error: "Model cannot be empty" }, { status: 400 });
    data.model = model;
  }
  if (has("year")) {
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 1980 || year > 2100) {
      return Response.json({ error: "A valid year is required" }, { status: 400 });
    }
    data.year = year;
  }
  if (has("trim")) data.trim = body.trim ? String(body.trim).trim() : null;
  if (has("bodyType")) {
    const bt = String(body.bodyType ?? "");
    if (!BODY_TYPES.includes(bt)) {
      return Response.json({ error: "Invalid body type" }, { status: 400 });
    }
    data.bodyType = bt as BodyType;
  }
  if (has("mileageKm")) {
    const m = Number(body.mileageKm);
    if (!Number.isFinite(m) || m < 0) {
      return Response.json({ error: "A valid mileage is required" }, { status: 400 });
    }
    data.mileageKm = Math.round(m);
  }
  if (has("conditionGrade")) {
    const g = String(body.conditionGrade ?? "").trim();
    if (!g) return Response.json({ error: "Condition grade cannot be empty" }, { status: 400 });
    data.conditionGrade = g;
  }
  if (has("vin")) data.vin = body.vin ? String(body.vin).trim().toUpperCase() : null;
  if (has("description")) {
    const d = String(body.description ?? "").trim();
    if (!d) return Response.json({ error: "Description cannot be empty" }, { status: 400 });
    data.description = d;
  }
  if (has("purchasePriceCAD")) {
    const p = String(body.purchasePriceCAD ?? "").trim();
    if (!(Number(p) > 0)) {
      return Response.json({ error: "A positive purchase price is required" }, { status: 400 });
    }
    data.purchasePriceCAD = new Prisma.Decimal(p);
  }
  if (has("defaultShippingMethod")) {
    const dm = String(body.defaultShippingMethod ?? "");
    if (!METHODS.includes(dm)) {
      return Response.json({ error: "Invalid default shipping method" }, { status: 400 });
    }
    data.defaultShippingMethod = dm as ShippingMethod;
  }
  if (has("handlingRateOverride")) {
    const raw = body.handlingRateOverride;
    if (raw === null || String(raw).trim() === "") {
      data.handlingRateOverride = null;
    } else if (Number(raw) >= 0) {
      data.handlingRateOverride = new Prisma.Decimal(String(raw).trim());
    } else {
      return Response.json({ error: "Handling override must be a number like 0.12" }, { status: 400 });
    }
  }

  // ---- status transition (validated) ----
  let nextStatus: string | null = null;
  if (has("status")) {
    const target = String(body.status ?? "");
    if (target !== current.status) {
      const allowed = ALLOWED[current.status] ?? [];
      if (!allowed.includes(target)) {
        return Response.json(
          { error: `Cannot move a ${current.status} vehicle to ${target}` },
          { status: 409 },
        );
      }
      if (target === "AVAILABLE") {
        // Publish gate: a buyer-facing listing must be able to compute a real total.
        if (current._count.shippingOptions < 1) {
          return Response.json(
            { error: "Add at least one shipping option before publishing" },
            { status: 409 },
          );
        }
        if (current._count.clearingQuotes < 1) {
          return Response.json(
            { error: "Add a clearing quote before publishing" },
            { status: 409 },
          );
        }
      }
      nextStatus = target;
      data.status = target as VehicleStatus;
    }
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          actorId: actor.actorId,
          entity: "Vehicle",
          entityId: id,
          action: nextStatus ? "vehicle.status" : "vehicle.update",
          before: nextStatus ? { status: current.status } : Prisma.JsonNull,
          after: nextStatus
            ? { status: nextStatus }
            : ({ fields: Object.keys(data) } as Prisma.InputJsonValue),
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: "A vehicle with that VIN already exists" }, { status: 409 });
    }
    return Response.json({ error: "Could not update vehicle" }, { status: 500 });
  }

  const fresh = await getVehicleForEdit(id);
  return Response.json(fresh);
}
