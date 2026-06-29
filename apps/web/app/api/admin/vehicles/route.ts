import { Prisma, type BodyType, type ShippingMethod, type Transmission, type FuelType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminActor } from "@/lib/admin-guard";
import { isTransmission, isFuelType, isColour } from "@/lib/vehicle-spec";

export const dynamic = "force-dynamic";

const BODY_TYPES = [
  "SUV", "SEDAN", "HATCHBACK", "WAGON", "COUPE", "TRUCK", "VAN", "OTHER",
];
const METHODS = ["RORO", "CONTAINER"];

// Admin creates a listing. Always starts in DRAFT; publishing (-> AVAILABLE)
// happens via PATCH once shipping + clearing exist.
export async function POST(req: Request) {
  const actor = await adminActor();
  if (!actor) return Response.json({ error: "Admin required" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const make = String(body.make ?? "").trim();
  const model = String(body.model ?? "").trim();
  const year = Number(body.year);
  const bodyType = String(body.bodyType ?? "");
  const mileageKm = Number(body.mileageKm);
  const conditionGrade = String(body.conditionGrade ?? "").trim();
  const description = String(body.description ?? "").trim();
  const purchasePriceCAD = String(body.purchasePriceCAD ?? "").trim();
  const transmission = String(body.transmission ?? "").trim();
  const fuelType = String(body.fuelType ?? "").trim();
  const colour = String(body.colour ?? "").trim();
  const trim = body.trim ? String(body.trim).trim() : null;
  const vin = body.vin ? String(body.vin).trim().toUpperCase() : null;
  const defaultShippingMethod = METHODS.includes(String(body.defaultShippingMethod))
    ? String(body.defaultShippingMethod)
    : "RORO";
  const handlingRaw = body.handlingRateOverride;
  const handlingRateOverride =
    handlingRaw !== undefined && handlingRaw !== null && String(handlingRaw).trim() !== ""
      ? String(handlingRaw).trim()
      : null;

  if (!make || !model) {
    return Response.json({ error: "Make and model are required" }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 1980 || year > 2100) {
    return Response.json({ error: "A valid year is required" }, { status: 400 });
  }
  if (!BODY_TYPES.includes(bodyType)) {
    return Response.json({ error: "Invalid body type" }, { status: 400 });
  }
  if (!Number.isFinite(mileageKm) || mileageKm < 0) {
    return Response.json({ error: "A valid mileage is required" }, { status: 400 });
  }
  if (!conditionGrade) {
    return Response.json({ error: "Condition grade is required" }, { status: 400 });
  }
  if (!isTransmission(transmission)) {
    return Response.json({ error: "A valid transmission is required" }, { status: 400 });
  }
  if (!isFuelType(fuelType)) {
    return Response.json({ error: "A valid fuel type is required" }, { status: 400 });
  }
  if (!isColour(colour)) {
    return Response.json({ error: "A valid colour is required" }, { status: 400 });
  }
  if (!description) {
    return Response.json({ error: "Description is required" }, { status: 400 });
  }
  if (!(Number(purchasePriceCAD) > 0)) {
    return Response.json({ error: "A positive purchase price is required" }, { status: 400 });
  }
  if (handlingRateOverride !== null && !(Number(handlingRateOverride) >= 0)) {
    return Response.json({ error: "Handling override must be a number like 0.12" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const v = await tx.vehicle.create({
        data: {
          make,
          model,
          year,
          trim,
          bodyType: bodyType as BodyType,
          mileageKm: Math.round(mileageKm),
          conditionGrade,
          transmission: transmission as Transmission,
          fuelType: fuelType as FuelType,
          colour,
          vin,
          description,
          purchasePriceCAD: new Prisma.Decimal(purchasePriceCAD),
          defaultShippingMethod: defaultShippingMethod as ShippingMethod,
          handlingRateOverride: handlingRateOverride
            ? new Prisma.Decimal(handlingRateOverride)
            : null,
          status: "DRAFT",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.actorId,
          entity: "Vehicle",
          entityId: v.id,
          action: "vehicle.create",
          after: { make, model, year, status: "DRAFT" },
        },
      });
      return v;
    });
    return Response.json({ id: created.id, status: created.status }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: "A vehicle with that VIN already exists" }, { status: 409 });
    }
    return Response.json({ error: "Could not create vehicle" }, { status: 500 });
  }
}
