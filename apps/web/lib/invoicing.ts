import "server-only";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import {
  computeLandedCost,
  toDisplay,
  serializeLandedCost,
  selectShippingCost,
  type ShippingMethod,
} from "@carbridge/shared";
import { prisma } from "./prisma";
import { getVehicleDetail } from "./vehicles";
import { getCurrentSnapshot } from "./fx";
import { nextDocumentNumber } from "./numbering";
import { getBankInstructions, invoiceDueDays } from "./settings";
import { applyPremiumGrant } from "./subscriptions";

export type ServiceResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status: number };

const fail = (error: string, status: number): { ok: false; error: string; status: number } => ({
  ok: false,
  error,
  status,
});

/**
 * Reconstruct the itemized landed breakdown for a reservation, pinned to its
 * LOCKED rate (so the quote/invoice document is internally consistent with the
 * rate the buyer was quoted). Totals on the documents come from the reservation's
 * authoritative lockedTotalCAD/NGN — this only rebuilds the per-line display.
 */
async function reservationBreakdown(reservation: {
  vehicleId: string;
  shippingMethod: string;
  rateLock: { rate: Prisma.Decimal; expiresAt: Date } | null;
}) {
  const vehicle = await getVehicleDetail(reservation.vehicleId);
  if (!vehicle) return null;

  const method = reservation.shippingMethod as ShippingMethod;
  const lockedRate =
    reservation.rateLock?.rate.toString() ?? (await getCurrentSnapshot()).effectiveRate;

  const shippingCostCAD = selectShippingCost(
    vehicle.shippingOptions.map((o) => ({
      method: o.method,
      containerType: o.containerType ?? undefined,
      costCAD: o.costCAD,
    })),
    method,
  ).toString();

  const breakdown = computeLandedCost({
    purchasePriceCAD: vehicle.purchasePriceCAD,
    shippingCostCAD,
    clearingCostNGN: vehicle.clearingCostNGN,
    fxRate: lockedRate,
    handlingRate: vehicle.handlingRate ?? undefined,
  });

  return {
    method,
    lockedRate,
    display: toDisplay(breakdown),
    serialized: serializeLandedCost(breakdown),
  };
}

/* ------------------------------- issue quote ------------------------------- */

export async function issueQuotationForReservation(
  reservationId: string,
  actorId: string | null,
): Promise<ServiceResult<{ quotationId: string; number: string }>> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { rateLock: true },
  });
  if (!reservation) return fail("Reservation not found", 404);
  if (reservation.status !== "PENDING" && reservation.status !== "CONFIRMED") {
    return fail(`Cannot quote a ${reservation.status} reservation`, 409);
  }

  const existing = await prisma.quotation.findFirst({
    where: { reservationId, status: { not: "VOID" } },
  });
  if (existing) {
    return fail("A quotation already exists for this reservation", 409);
  }

  const b = await reservationBreakdown(reservation);
  if (!b) return fail("Vehicle for this reservation no longer exists", 409);

  const number = await nextDocumentNumber("QUOTE");
  const snapshot = {
    breakdown: b.display,
    serialized: b.serialized,
    method: b.method,
    fxRate: b.lockedRate,
  } as unknown as Prisma.InputJsonValue;

  const quotation = await prisma.$transaction(async (tx) => {
    const q = await tx.quotation.create({
      data: {
        number,
        reservationId: reservation.id,
        vehicleId: reservation.vehicleId,
        userId: reservation.userId,
        snapshot,
        fxRate: new Prisma.Decimal(b.lockedRate),
        totalCAD: reservation.lockedTotalCAD,
        totalNGN: reservation.lockedTotalNGN,
        status: "ISSUED",
        issuedAt: new Date(),
        validUntil: reservation.rateLock?.expiresAt ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Quotation",
        entityId: q.id,
        action: "quotation.issue",
        after: {
          number,
          reservationId: reservation.id,
          totalNGN: reservation.lockedTotalNGN.toString(),
        } as Prisma.InputJsonValue,
      },
    });
    return q;
  });

  return { ok: true, quotationId: quotation.id, number };
}

/* ------------------------------ issue invoice ------------------------------ */

export async function issueInvoiceForQuotation(
  quotationId: string,
  actorId: string | null,
): Promise<ServiceResult<{ invoiceId: string; number: string }>> {
  const q = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!q) return fail("Quotation not found", 404);
  if (q.status !== "ISSUED" && q.status !== "ACCEPTED") {
    return fail(`Cannot invoice a ${q.status} quotation`, 409);
  }

  const existing = await prisma.invoice.findFirst({
    where: { quotationId, status: { not: "VOID" } },
  });
  if (existing) return fail("An invoice already exists for this quotation", 409);

  const number = await nextDocumentNumber("INVOICE");
  const bank = getBankInstructions();
  const dueAt = new Date(Date.now() + invoiceDueDays() * 24 * 60 * 60 * 1000);

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        number,
        kind: "CAR",
        userId: q.userId,
        quotationId: q.id,
        currency: "NGN",
        amount: q.totalNGN,
        amountPaid: new Prisma.Decimal(0),
        bankInstructions: bank as unknown as Prisma.InputJsonValue,
        status: "ISSUED",
        issuedAt: new Date(),
        dueAt,
      },
    });
    // Issuing an invoice converts the quote — mark it accepted.
    await tx.quotation.update({ where: { id: q.id }, data: { status: "ACCEPTED" } });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Invoice",
        entityId: inv.id,
        action: "invoice.issue",
        after: {
          number,
          quotationId: q.id,
          amountNGN: q.totalNGN.toString(),
        } as Prisma.InputJsonValue,
      },
    });
    return inv;
  });

  return { ok: true, invoiceId: invoice.id, number };
}

/* ------------------------ issue membership invoice ------------------------ */

export async function issueMembershipInvoice(
  userId: string,
  amountNGN: string,
  actorId: string | null,
): Promise<ServiceResult<{ invoiceId: string; number: string }>> {
  const amount = String(amountNGN ?? "").trim();
  if (!(Number(amount) > 0)) return fail("A positive amount is required", 400);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return fail("Buyer not found", 404);

  const number = await nextDocumentNumber("INVOICE");
  const bank = getBankInstructions();
  const dueAt = new Date(Date.now() + invoiceDueDays() * 24 * 60 * 60 * 1000);

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        number,
        kind: "MEMBERSHIP",
        userId,
        currency: "NGN",
        amount: new Prisma.Decimal(amount),
        amountPaid: new Prisma.Decimal(0),
        bankInstructions: bank as unknown as Prisma.InputJsonValue,
        status: "ISSUED",
        issuedAt: new Date(),
        dueAt,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Invoice",
        entityId: inv.id,
        action: "membership.invoice",
        after: { number, userId, amountNGN: amount } as Prisma.InputJsonValue,
      },
    });
    return inv;
  });

  return { ok: true, invoiceId: invoice.id, number };
}

export interface RecordPaymentInput {
  amount: string; // NGN decimal string
  reference: string; // dedup key (bank transfer reference)
  paidAt?: string | null; // ISO; defaults to now
  note?: string | null;
}

export async function recordPayment(
  invoiceId: string,
  input: RecordPaymentInput,
  actorId: string | null,
): Promise<
  ServiceResult<{
    invoiceStatus: InvoiceStatus;
    amountPaid: string;
    reservationAdvanced: boolean;
    premiumGranted: boolean;
  }>
> {
  const amount = String(input.amount ?? "").trim();
  if (!(Number(amount) > 0)) return fail("A positive amount is required", 400);
  const reference = String(input.reference ?? "").trim();
  if (!reference) return fail("A payment reference is required", 400);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { quotation: { include: { reservation: true } } },
  });
  if (!invoice) return fail("Invoice not found", 404);
  if (invoice.status === "VOID") return fail("Invoice is void", 409);

  // Global dedup: a real-world transfer reference maps to exactly one Payment.
  // If it already exists against a DIFFERENT invoice, refuse rather than confuse.
  const priorByRef = await prisma.payment.findUnique({ where: { reference } });
  if (priorByRef && priorByRef.invoiceId !== invoiceId) {
    return fail("That reference is already recorded against another invoice", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Upsert-by-reference: a repeat submit of the same reference is idempotent.
    await tx.payment.upsert({
      where: { reference },
      create: {
        invoiceId,
        reference,
        amount: new Prisma.Decimal(amount),
        currency: "NGN",
        source: "CARBRIDGE",
        recordedById: actorId,
        note: input.note ?? null,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      },
      update: {}, // idempotent no-op on duplicate reference
    });

    const agg = await tx.payment.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });
    const paid = agg._sum.amount ?? new Prisma.Decimal(0);
    const total = invoice.amount;

    let status: InvoiceStatus = invoice.status;
    if (total.gt(0) && paid.gte(total)) status = "PAID";
    else if (paid.gt(0)) status = "PART_PAID";
    else status = "ISSUED";

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: paid, status, paidAt: status === "PAID" ? new Date() : null },
    });

    // On full payment: CAR invoices auto-confirm the reservation + SOLD;
    // MEMBERSHIP invoices grant Premium (extend-in-place).
    let reservationAdvanced = false;
    let premiumGranted = false;
    if (status === "PAID") {
      if (invoice.kind === "CAR") {
        const reservation = invoice.quotation?.reservation ?? null;
        if (reservation && reservation.status === "PENDING") {
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "CONFIRMED" },
          });
          await tx.vehicle.updateMany({
            where: { id: reservation.vehicleId, status: "RESERVED" },
            data: { status: "SOLD" },
          });
          reservationAdvanced = true;
        }
      } else if (invoice.kind === "MEMBERSHIP") {
        await applyPremiumGrant(tx, invoice.userId, { invoiceId: invoice.id });
        premiumGranted = true;
      }
    }

    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Invoice",
        entityId: invoiceId,
        action: "payment.record",
        after: {
          reference,
          amountNGN: amount,
          invoiceStatus: status,
          reservationAdvanced,
          premiumGranted,
        } as Prisma.InputJsonValue,
      },
    });

    return { invoiceStatus: status, amountPaid: paid.toString(), reservationAdvanced, premiumGranted };
  });

  return { ok: true, ...result };
}
