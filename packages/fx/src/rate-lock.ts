import type { FxPair } from "./types";

/** Rate locks hold for 72 hours by default (SRD §9). */
export const RATE_LOCK_TTL_MS = 72 * 60 * 60 * 1000;

export type RateLockContext = "QUOTE" | "OFFER" | "RESERVATION";

export interface CreateRateLockInput {
  pair: FxPair;
  /** The effective rate being locked, as a decimal string. */
  rate: string;
  context: RateLockContext;
  /** Injectable clock for deterministic tests. */
  now?: Date;
  /** Override the default 72h TTL if needed. */
  ttlMs?: number;
}

export interface RateLockRecord {
  pair: FxPair;
  rate: string;
  context: RateLockContext;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Build a rate-lock record. This is pure — persist the result as a RateLock row
 * (the Prisma model already exists) and reference it from the Offer/Reservation.
 */
export function createRateLock({
  pair,
  rate,
  context,
  now = new Date(),
  ttlMs = RATE_LOCK_TTL_MS,
}: CreateRateLockInput): RateLockRecord {
  return {
    pair,
    rate,
    context,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttlMs),
  };
}

/** True while the lock is still within its TTL. */
export function isRateLockValid(
  lock: Pick<RateLockRecord, "expiresAt">,
  now: Date = new Date(),
): boolean {
  return now.getTime() < lock.expiresAt.getTime();
}

/** Milliseconds remaining on a lock (0 once expired). */
export function rateLockRemainingMs(
  lock: Pick<RateLockRecord, "expiresAt">,
  now: Date = new Date(),
): number {
  return Math.max(0, lock.expiresAt.getTime() - now.getTime());
}
