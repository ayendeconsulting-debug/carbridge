import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { sendPremiumGrantedEmail } from "./email";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

type Tx = Prisma.TransactionClient;

/**
 * Apply a manual Premium grant within an existing transaction. Extends from the
 * current active expiry when the buyer is still active, otherwise one year from
 * today. Extends in place so a buyer keeps a single active subscription row
 * (which keeps the auto-downgrade sweep unambiguous). Always sets User.tier.
 */
export async function applyPremiumGrant(
  tx: Tx,
  userId: string,
  opts: { invoiceId?: string | null; plan?: string } = {},
): Promise<{ expiresAt: Date; created: boolean }> {
  const now = new Date();
  const active = await tx.subscription.findFirst({
    where: { userId, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
  });
  const base = active ? active.expiresAt : now;
  const expiresAt = new Date(base.getTime() + YEAR_MS);

  if (active) {
    await tx.subscription.update({
      where: { id: active.id },
      data: {
        expiresAt,
        // link the membership invoice only when this row isn't already linked
        ...(opts.invoiceId && !active.invoiceId ? { invoiceId: opts.invoiceId } : {}),
      },
    });
  } else {
    await tx.subscription.create({
      data: {
        userId,
        plan: opts.plan ?? "Premium (Manual)",
        status: "ACTIVE",
        provider: "MANUAL",
        providerRef: null,
        invoiceId: opts.invoiceId ?? null,
        startedAt: now,
        expiresAt,
      },
    });
  }
  await tx.user.update({ where: { id: userId }, data: { tier: "PREMIUM" } });
  return { expiresAt, created: !active };
}

/** Public direct grant (admin action). Wraps applyPremiumGrant + an AuditLog. */
export async function grantPremium(
  userId: string,
  opts: { invoiceId?: string | null; plan?: string } = {},
  actorId: string | null = null,
): Promise<{ expiresAt: string; created: boolean }> {
  const res = await prisma.$transaction(async (tx) => {
    const r = await applyPremiumGrant(tx, userId, opts);
    await tx.auditLog.create({
      data: {
        actorId,
        entity: "Subscription",
        entityId: userId,
        action: "premium.grant",
        after: {
          expiresAt: r.expiresAt.toISOString(),
          invoiceId: opts.invoiceId ?? null,
          created: r.created,
        } as Prisma.InputJsonValue,
      },
    });
    return r;
  });

  // Best-effort: notify the buyer their Premium is active (never throws).
  await sendPremiumGrantedEmail({ userId, expiresAt: res.expiresAt });

  return { expiresAt: res.expiresAt.toISOString(), created: res.created };
}

export interface FulfillInput {
  userId: string;
  /** Provider reference (Paystack transaction reference) — the idempotency key. */
  providerRef: string;
  plan: string;
}

/**
 * Fulfil a paid subscription: create an ACTIVE Subscription and upgrade the
 * user to PREMIUM. Idempotent on providerRef so a webhook + callback verify (or
 * a retried webhook) can't double-apply. Returns whether a new row was created.
 */
export async function fulfillSubscription(
  input: FulfillInput,
): Promise<{ created: boolean }> {
  const existing = await prisma.subscription.findFirst({
    where: { providerRef: input.providerRef },
    select: { id: true },
  });
  if (existing) return { created: false };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.subscription.create({
      data: {
        userId: input.userId,
        plan: input.plan,
        status: "ACTIVE",
        provider: "PAYSTACK",
        providerRef: input.providerRef,
        startedAt: now,
        expiresAt: new Date(now.getTime() + YEAR_MS),
      },
    });
    await tx.user.update({
      where: { id: input.userId },
      data: { tier: "PREMIUM" },
    });
  });
  return { created: true };
}

export async function getSubscriptionByRef(providerRef: string) {
  return prisma.subscription.findFirst({ where: { providerRef } });
}
