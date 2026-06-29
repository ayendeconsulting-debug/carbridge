import { prisma } from "./prisma";
import type { AdminUserView, AdminMembershipInvoiceView } from "./types";

/** Buyers (non-guest) for the grant/invoice target selector, with current
 *  active-Premium expiry when present. */
export async function listUsersForAdmin(): Promise<AdminUserView[]> {
  const now = new Date();
  const rows = await prisma.user.findMany({
    where: { tier: { in: ["REGISTERED", "PREMIUM"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      tier: true,
      subscriptions: {
        where: { status: "ACTIVE", expiresAt: { gt: now } },
        orderBy: { expiresAt: "desc" },
        take: 1,
        select: { expiresAt: true },
      },
    },
  });
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    tier: u.tier,
    premiumExpiresAt: u.subscriptions[0]?.expiresAt.toISOString() ?? null,
  }));
}

export async function listMembershipInvoicesForAdmin(): Promise<AdminMembershipInvoiceView[]> {
  const rows = await prisma.invoice.findMany({
    where: { kind: "MEMBERSHIP" },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });
  return rows.map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amountNGN: inv.amount.toString(),
    amountPaidNGN: inv.amountPaid.toString(),
    createdAt: inv.createdAt.toISOString(),
    dueAt: inv.dueAt ? inv.dueAt.toISOString() : null,
    buyer: { email: inv.user.email, name: inv.user.name },
  }));
}
