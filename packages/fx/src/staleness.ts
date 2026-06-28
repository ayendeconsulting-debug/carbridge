/** Default: a rate older than 60 minutes is considered stale. */
export const DEFAULT_STALE_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * True when `fetchedAt` is older than `thresholdMs` relative to `now`.
 * The UI uses this to show a "rate may be out of date" state and to decide
 * whether a fresh refresh should be forced before locking a rate.
 */
export function isStale(
  fetchedAt: Date,
  now: Date = new Date(),
  thresholdMs: number = DEFAULT_STALE_THRESHOLD_MS,
): boolean {
  return now.getTime() - fetchedAt.getTime() > thresholdMs;
}

/** Age of a quote in whole seconds (never negative). */
export function ageSeconds(fetchedAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - fetchedAt.getTime()) / 1000));
}
