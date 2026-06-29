import { prisma } from "./prisma";
import type { AdminBillingRow } from "./types";
import type { ShippingMethod } from "@carbridge/shared";

const vehicleName = (year: number, make: string, model: string) =>
  `${year} ${make} ${model}`;

/**
 * Billing pipeline for the admin console: one row per reservation, joined to its
 * latest non-void quotation and (through it) the latest non-void invoice with
 * paid progress. Drives the Issue-quote / Issue-invoice / Record-payment actions.
 */
export async function listBillingForAdmin(): Promise<AdminBillingRow[]> {
  const rows = await prisma.reservation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: { select: { id: true, year: true, make: true, model: true } },
      user: { select: { email: true, name: true } },
      quotations: {
        where: { status: { not: "VOID" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          invoices: {
            where: { status: { not: "VOID" } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return rows.map((r) => {
    const q = r.quotations[0] ?? null;
    const inv = q?.invoices[0] ?? null;
    return {
      reservationId: r.id,
      reservationStatus: r.status,
      lockedTotalNGN: r.lockedTotalNGN.toString(),
      lockedTotalCAD: r.lockedTotalCAD.toString(),
      shippingMethod: r.shippingMethod as ShippingMethod,
      createdAt: r.createdAt.toISOString(),
      vehicle: {
        id: r.vehicle.id,
        name: vehicleName(r.vehicle.year, r.vehicle.make, r.vehicle.model),
      },
      buyer: { email: r.user.email, name: r.user.name },
      quotation: q ? { id: q.id, number: q.number, status: q.status } : null,
      invoice: inv
        ? {
            id: inv.id,
            number: inv.number,
            status: inv.status,
            amountNGN: inv.amount.toString(),
            amountPaidNGN: inv.amountPaid.toString(),
            dueAt: inv.dueAt ? inv.dueAt.toISOString() : null,
          }
        : null,
    };
  });
}
