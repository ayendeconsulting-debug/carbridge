import type { Tier } from "./types";
import { TIER_COOKIE } from "./constants";
import { getAuthContext } from "./auth";
export { TIER_COOKIE };

/**
 * Tier for the current caller. Now backed by getAuthContext() - Clerk session →
 * DB tier when configured, else the dev-bypass (cb_tier cookie + demo user).
 * Callers (layout, upgrade page) are unchanged.
 */
export async function getTier(): Promise<Tier> {
  return (await getAuthContext()).tier;
}

export function isPremium(tier: Tier): boolean {
  return tier === "PREMIUM";
}
