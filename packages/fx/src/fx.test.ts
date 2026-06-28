import { describe, it, expect } from "vitest";
import {
  applySpread,
  isStale,
  ageSeconds,
  DEFAULT_STALE_THRESHOLD_MS,
  createFixedProvider,
  createJitterProvider,
  createOpenErApiProvider,
  refreshFxRate,
  createRateLock,
  isRateLockValid,
  rateLockRemainingMs,
  RATE_LOCK_TTL_MS,
} from "./index";

describe("applySpread", () => {
  it("returns the raw rate unchanged at 0 bps", () => {
    expect(applySpread("1150", 0)).toBe("1150");
    expect(applySpread("1149.5")).toBe("1149.5");
  });

  it("applies basis-point margins exactly (no float drift)", () => {
    expect(applySpread("1150", 150)).toBe("1167.25"); // +1.50%
    expect(applySpread("1150", 250)).toBe("1178.75"); // +2.50%
    expect(applySpread("1000", 50)).toBe("1005"); // +0.50%
  });

  it("accepts string or number inputs", () => {
    expect(applySpread(1150, 150)).toBe("1167.25");
  });
});

describe("staleness", () => {
  const base = new Date("2026-06-27T12:00:00Z");

  it("is fresh at zero age and below threshold", () => {
    expect(isStale(base, base)).toBe(false);
    const fiftyNine = new Date(base.getTime() + 59 * 60 * 1000);
    expect(isStale(base, fiftyNine)).toBe(false);
  });

  it("is stale past the threshold", () => {
    const sixtyOne = new Date(base.getTime() + 61 * 60 * 1000);
    expect(isStale(base, sixtyOne)).toBe(true);
  });

  it("respects a custom threshold", () => {
    const tenMin = new Date(base.getTime() + 10 * 60 * 1000);
    expect(isStale(base, tenMin, 5 * 60 * 1000)).toBe(true);
    expect(DEFAULT_STALE_THRESHOLD_MS).toBe(3_600_000);
  });

  it("reports age in whole seconds, never negative", () => {
    expect(ageSeconds(base, new Date(base.getTime() + 90_000))).toBe(90);
    expect(ageSeconds(base, new Date(base.getTime() - 5000))).toBe(0);
  });
});

describe("fixed provider", () => {
  it("returns the configured rate", async () => {
    const p = createFixedProvider({ rate: "1150" });
    const q = await p.getRate("CAD_NGN");
    expect(q.rawRate).toBe("1150");
    expect(q.source).toBe("fixed");
    expect(q.pair).toBe("CAD_NGN");
    expect(q.fetchedAt).toBeInstanceOf(Date);
  });
});

describe("open-er-api provider", () => {
  const ok = (rates: Record<string, number>) => ({
    ok: true,
    status: 200,
    json: async () => ({ rates }),
  });

  it("extracts NGN per CAD from the response", async () => {
    const p = createOpenErApiProvider({
      baseUrl: "https://example.test/v6/latest",
      fetchImpl: async (url: string) => {
        expect(url).toBe("https://example.test/v6/latest/CAD");
        return ok({ NGN: 1149.5, USD: 0.73 });
      },
    });
    const q = await p.getRate("CAD_NGN");
    expect(q.rawRate).toBe("1149.5");
    expect(q.source).toBe("open-er-api");
  });

  it("throws on non-OK HTTP", async () => {
    const p = createOpenErApiProvider({
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    });
    await expect(p.getRate("CAD_NGN")).rejects.toThrow(/503/);
  });

  it("throws when the quote currency is missing", async () => {
    const p = createOpenErApiProvider({
      fetchImpl: async () => ok({ USD: 0.73 }),
    });
    await expect(p.getRate("CAD_NGN")).rejects.toThrow(/no NGN/);
  });
});

describe("jitter provider (dev-only)", () => {
  // Deterministic RNG: cycles through fixed values so the walk is reproducible.
  const seededRng = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("starts from the centre and drifts on each call", async () => {
    // 0.5 → signed delta 0, so the first tick stays exactly at centre.
    const p = createJitterProvider({ center: "1150", random: () => 0.5 });
    const q = await p.getRate("CAD_NGN");
    expect(q.rawRate).toBe("1150");
    expect(q.source).toBe("dev-jitter");
    expect(q.pair).toBe("CAD_NGN");
  });

  it("moves up and down with the RNG and stays a decimal string", async () => {
    // 1 → +full step (+0.4% of 1150 = +4.6); 0 → -full step (-4.6).
    const p = createJitterProvider({
      center: "1150",
      stepPct: 0.004,
      random: seededRng([1, 0]),
    });
    const up = await p.getRate("CAD_NGN");
    expect(up.rawRate).toBe("1154.6"); // 1150 + 4.6
    const down = await p.getRate("CAD_NGN");
    expect(down.rawRate).toBe("1150"); // 1154.6 - 4.6
    expect(typeof up.rawRate).toBe("string");
    expect(up.rawRate).not.toContain("e"); // no float exponent drift
  });

  it("never strays beyond the clamp band even under a one-directional walk", async () => {
    // Always +full step; band ±1% of 1150 => [1138.5, 1161.5].
    const p = createJitterProvider({
      center: "1150",
      stepPct: 0.01,
      bandPct: 0.01,
      random: () => 1,
    });
    let last = "";
    for (let i = 0; i < 50; i++) last = (await p.getRate("CAD_NGN")).rawRate;
    expect(Number(last)).toBeLessThanOrEqual(1161.5);
    expect(Number(last)).toBe(1161.5); // pinned to the upper bound
  });

  it("respects a custom id", async () => {
    const p = createJitterProvider({ center: 1150, id: "demo-walk" });
    const q = await p.getRate("CAD_NGN");
    expect(q.source).toBe("demo-walk");
  });
});

describe("refreshFxRate", () => {
  it("produces a snapshot with raw + effective rate and fresh flag", async () => {
    const now = new Date("2026-06-27T12:00:00Z");
    const snap = await refreshFxRate(
      createFixedProvider({ rate: "1150" }),
      "CAD_NGN",
      { spreadBps: 150, now },
    );
    expect(snap.rawRate).toBe("1150");
    expect(snap.effectiveRate).toBe("1167.25");
    expect(snap.source).toBe("fixed");
    expect(snap.isStale).toBe(false);
  });

  it("defaults to a 0 bp spread", async () => {
    const snap = await refreshFxRate(
      createFixedProvider({ rate: "1200" }),
      "CAD_NGN",
    );
    expect(snap.effectiveRate).toBe("1200");
  });
});

describe("rate lock", () => {
  const now = new Date("2026-06-27T12:00:00Z");

  it("expires 72h after creation by default", () => {
    const lock = createRateLock({
      pair: "CAD_NGN",
      rate: "1167.25",
      context: "OFFER",
      now,
    });
    expect(lock.expiresAt.getTime() - lock.createdAt.getTime()).toBe(
      RATE_LOCK_TTL_MS,
    );
    expect(lock.rate).toBe("1167.25");
    expect(lock.context).toBe("OFFER");
  });

  it("is valid before expiry and invalid after", () => {
    const lock = createRateLock({
      pair: "CAD_NGN",
      rate: "1150",
      context: "QUOTE",
      now,
    });
    const within = new Date(now.getTime() + 71 * 60 * 60 * 1000);
    const after = new Date(now.getTime() + 73 * 60 * 60 * 1000);
    expect(isRateLockValid(lock, within)).toBe(true);
    expect(isRateLockValid(lock, after)).toBe(false);
    expect(rateLockRemainingMs(lock, within)).toBe(60 * 60 * 1000);
    expect(rateLockRemainingMs(lock, after)).toBe(0);
  });
});
