import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { sendOfferAcceptedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type Action = "accept" | "decline" | "counter";

// Admin response to an offer. Guarded transitions; each writes an AuditLog.
//   accept  : SUBMITTED|COUNTERED -> ACCEPTED  (vehicle untouched)
//   decline : SUBMITTED|COUNTERED -> DECLINED
//   counter : SUBMITTED          -> COUNTERED  (counter amount stored in snapshot)
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

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) return Response.json({ error: "Offer not found" }, { status: 404 });

  const open = offer.status === "SUBMITTED" || offer.status === "COUNTERED";

  if (action === "accept" || action === "decline") {
    if (!open) {
      return Response.json(
        { error: `Cannot ${action} an offer that is ${offer.status}` },
        { status: 409 },
      );
    }
    const next = action === "accept" ? "ACCEPTED" : "DECLINED";
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.offer.update({
        where: { id },
        data: { status: next },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          entity: "Offer",
          entityId: id,
          action: `offer.${action}`,
          before: { status: offer.status },
          after: { status: next },
        },
      });
      return u;
    });

    if (next === "ACCEPTED") {
      // Best-effort: nudge the buyer to reserve at the agreed price (never throws).
      const snap = offer.listingSnapshot as { counter?: { amount?: string; currency?: string } } | null;
      const counter = snap?.counter;
      const agreedAmount =
        counter && typeof counter.amount === "string" ? counter.amount : offer.amount.toString();
      const agreedCurrency =
        counter && (counter.currency === "CAD" || counter.currency === "NGN")
          ? counter.currency
          : (offer.currency as "NGN" | "CAD");
      const v = await prisma.vehicle.findUnique({
        where: { id: offer.vehicleId },
        select: { year: true, make: true, model: true },
      });
      await sendOfferAcceptedEmail({
        userId: offer.userId,
        vehicleName: v ? `${v.year} ${v.make} ${v.model}` : "your vehicle",
        agreedAmount,
        agreedCurrency,
      });
    }

    return Response.json({ id: updated.id, status: updated.status });
  }

  if (action === "counter") {
    if (offer.status !== "SUBMITTED") {
      return Response.json(
        { error: `Cannot counter an offer that is ${offer.status}` },
        { status: 409 },
      );
    }
    const amount = String(body.amount ?? "").trim();
    if (!amount || !(Number(amount) > 0)) {
      return Response.json({ error: "A positive counter amount is required" }, { status: 400 });
    }
    const currency = body.currency === "CAD" ? "CAD" : "NGN";

    const snapshot =
      offer.listingSnapshot && typeof offer.listingSnapshot === "object"
        ? (offer.listingSnapshot as Record<string, unknown>)
        : {};
    const nextSnapshot = {
      ...snapshot,
      counter: { amount, currency, at: new Date().toISOString() },
    } as unknown as Prisma.InputJsonValue;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.offer.update({
        where: { id },
        data: { status: "COUNTERED", listingSnapshot: nextSnapshot },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          entity: "Offer",
          entityId: id,
          action: "offer.counter",
          before: { status: offer.status },
          after: { status: "COUNTERED", counter: { amount, currency } },
        },
      });
      return u;
    });
    return Response.json({ id: updated.id, status: updated.status, counter: { amount, currency } });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
