import { prisma } from "./prisma";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

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
