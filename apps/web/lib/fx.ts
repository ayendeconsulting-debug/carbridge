import {
  isStale,
  ageSeconds,
  refreshFxRate,
  createOpenErApiProvider,
  createJitterProvider,
  type FxProvider,
} from "@carbridge/fx";
import { prisma } from "./prisma";
import { getRedis, FX_CACHE_KEY } from "./redis";
import type { FxView } from "./types";

interface CachedSnapshot {
  pair: "CAD_NGN";
  rawRate: string;
  effectiveRate: string;
  source: string;
  fetchedAt: string; // ISO
}

function toView(s: CachedSnapshot): FxView {
  const fetched = new Date(s.fetchedAt);
  return {
    pair: "CAD_NGN",
    rawRate: s.rawRate,
    effectiveRate: s.effectiveRate,
    source: s.source,
    fetchedAt: fetched.toISOString(),
    isStale: isStale(fetched),
    ageSeconds: ageSeconds(fetched),
  };
}

/** Read the current rate: Upstash cache → latest persisted row → safe fallback. */
export async function getCurrentSnapshot(): Promise<FxView> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<CachedSnapshot | string>(FX_CACHE_KEY);
      if (cached) {
        const obj = typeof cached === "string" ? (JSON.parse(cached) as CachedSnapshot) : cached;
        return toView(obj);
      }
    } catch {
      // fall through to DB
    }
  }
  try {
    const row = await prisma.fxRate.findFirst({
      where: { pair: "CAD_NGN" },
      orderBy: { fetchedAt: "desc" },
    });
    if (row) {
      return toView({
        pair: "CAD_NGN",
        rawRate: row.rawRate.toString(),
        effectiveRate: row.effectiveRate.toString(),
        source: row.source,
        fetchedAt: row.fetchedAt.toISOString(),
      });
    }
  } catch {
    // fall through to constant
  }
  // Never show a broken price: seeded constant as last resort.
  return toView({
    pair: "CAD_NGN",
    rawRate: "1150",
    effectiveRate: "1167.25",
    source: "fallback",
    fetchedAt: new Date().toISOString(),
  });
}

/**
 * Pick the FX source. Production uses the real keyless provider. When
 * FX_DEV_JITTER === "1" (LOCAL DEV ONLY) we use a bounded random walk so the
 * live naira total visibly reprices on every refresh — the open.er-api rate is
 * near-static intraday and won't demonstrate the feature otherwise. Never set
 * FX_DEV_JITTER in a deployed environment.
 */
function selectFxProvider(): FxProvider {
  if (process.env.FX_DEV_JITTER === "1") {
    const center = process.env.FX_DEV_JITTER_CENTER ?? "1150";
    return createJitterProvider({ center });
  }
  return createOpenErApiProvider();
}

/** Fetch a fresh rate, persist it, and cache it. Called by /api/fx/refresh. */
export async function refreshAndStore(): Promise<FxView> {
  const spreadBps = process.env.FX_SPREAD_BPS ?? "0";
  const snap = await refreshFxRate(selectFxProvider(), "CAD_NGN", {
    spreadBps,
  });

  await prisma.fxRate.create({
    data: {
      pair: "CAD_NGN",
      rawRate: snap.rawRate,
      effectiveRate: snap.effectiveRate,
      source: snap.source,
      isStale: snap.isStale,
      fetchedAt: snap.fetchedAt,
    },
  });

  const cached: CachedSnapshot = {
    pair: "CAD_NGN",
    rawRate: snap.rawRate,
    effectiveRate: snap.effectiveRate,
    source: snap.source,
    fetchedAt: snap.fetchedAt.toISOString(),
  };

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(FX_CACHE_KEY, cached, { ex: 900 });
    } catch {
      // caching is best-effort
    }
  }
  return toView(cached);
}
