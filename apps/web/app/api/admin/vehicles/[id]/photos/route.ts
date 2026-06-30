import { Prisma } from "@prisma/client";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { adminActor } from "@/lib/admin-guard";
import { getVehicleForEdit } from "@/lib/admin-catalog";

export const dynamic = "force-dynamic";

const MAX_PHOTOS = 12;
// Defense-in-depth: the client downscales before sending, so anything near the
// platform's ~4.5MB function-body cap shouldn't reach here.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

// Upload: the browser posts a (downscaled) image as multipart/form-data; the
// server streams it to Blob with put(). On Vercel this authenticates via OIDC
// (BLOB_STORE_ID + VERCEL_OIDC_TOKEN) - no read-write token required.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await adminActor();
  if (!actor) return Response.json({ error: "Admin required" }, { status: 403 });
  const { id } = await params;

  const vehicle = await prisma.vehicle.findUnique({ where: { id }, select: { id: true } });
  if (!vehicle) return Response.json({ error: "Vehicle not found" }, { status: 404 });

  const count = await prisma.vehiclePhoto.count({ where: { vehicleId: id } });
  if (count >= MAX_PHOTOS) {
    return Response.json(
      { error: `A vehicle can have at most ${MAX_PHOTOS} photos` },
      { status: 409 },
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ error: "Expected a multipart form upload" }, { status: 400 });
  }
  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

  const contentType = file.type || "image/jpeg";
  if (!ALLOWED.includes(contentType)) {
    return Response.json({ error: "Unsupported image type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Image is too large even after processing - try a smaller photo" },
      { status: 413 },
    );
  }

  const ext = contentType === "image/png" ? "png"
    : contentType === "image/webp" ? "webp"
    : contentType === "image/avif" ? "avif"
    : "jpg";
  const pathname = `vehicles/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  let url: string;
  try {
    const blob = await put(pathname, file, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    url = blob.url;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed" },
      { status: 502 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehiclePhoto.create({
        data: { vehicleId: id, url, position: count },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.actorId,
          entity: "Vehicle",
          entityId: id,
          action: "photo.add",
          after: { position: count } as Prisma.InputJsonValue,
        },
      });
    });
  } catch {
    return Response.json({ error: "Photo uploaded but could not be saved" }, { status: 500 });
  }

  const fresh = await getVehicleForEdit(id);
  return Response.json(fresh);
}

// Reorder: body { order: photoId[] } in the new display order. Two-pass to avoid
// the @@unique([vehicleId, position]) collision (offset to negatives, then final).
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

  const order = Array.isArray(body.order) ? (body.order as unknown[]).map(String) : null;
  if (!order || order.length === 0) {
    return Response.json({ error: "An order array of photo ids is required" }, { status: 400 });
  }

  const existing = await prisma.vehiclePhoto.findMany({
    where: { vehicleId: id },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((p) => p.id));
  if (order.length !== existing.length || !order.every((pid) => existingIds.has(pid))) {
    return Response.json(
      { error: "Order must list exactly the vehicle's photo ids" },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // pass 1 - move all to unique negative temporaries
      for (let i = 0; i < order.length; i++) {
        await tx.vehiclePhoto.update({
          where: { id: order[i]! },
          data: { position: -(i + 1) },
        });
      }
      // pass 2 - assign final 0..n-1
      for (let i = 0; i < order.length; i++) {
        await tx.vehiclePhoto.update({
          where: { id: order[i]! },
          data: { position: i },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.actorId,
          entity: "Vehicle",
          entityId: id,
          action: "photo.reorder",
          after: { count: order.length } as Prisma.InputJsonValue,
        },
      });
    });
  } catch {
    return Response.json({ error: "Could not reorder photos" }, { status: 500 });
  }

  const fresh = await getVehicleForEdit(id);
  return Response.json(fresh);
}
