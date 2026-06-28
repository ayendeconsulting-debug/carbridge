#!/usr/bin/env node
// CarBridge — local dev FX ticker.
//
// Pings POST /api/fx/refresh on an interval so the CAD→NGN rate (and every
// landed-cost total) reprices live while you develop. This is the LOCAL stand-in
// for the GitHub Actions cron, which can't reach localhost. Pair it with
// FX_DEV_JITTER=1 in apps/web/.env.local so the rate actually moves each tick.
//
// Usage (from repo root, with the web app already running):
//   pnpm fx:tick
//   pnpm fx:tick --interval 30 --url http://localhost:3000/api/fx/refresh
//
// The bearer secret is read from FX_REFRESH_SECRET, or auto-loaded from
// apps/web/.env.local so you don't have to export anything. Ctrl-C to stop.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- tiny .env reader (no dependency) -------------------------------------
function loadEnvFile(path) {
  try {
    const out = {};
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

// --- args ------------------------------------------------------------------
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const url = arg("url", process.env.FX_REFRESH_URL ?? "http://localhost:3000/api/fx/refresh");
const intervalSec = Number(arg("interval", process.env.FX_TICK_INTERVAL ?? "15"));

const envLocal = loadEnvFile(resolve(__dirname, "..", "apps", "web", ".env.local"));
const secret = process.env.FX_REFRESH_SECRET ?? envLocal.FX_REFRESH_SECRET;

if (!secret) {
  console.error(
    "✗ No FX_REFRESH_SECRET found.\n" +
      "  Set it in apps/web/.env.local (same value the refresh route checks),\n" +
      "  or export FX_REFRESH_SECRET before running.",
  );
  process.exit(1);
}
if (!Number.isFinite(intervalSec) || intervalSec < 1) {
  console.error("✗ --interval must be a number of seconds ≥ 1.");
  process.exit(1);
}

const jitterOn = envLocal.FX_DEV_JITTER === "1" || process.env.FX_DEV_JITTER === "1";

console.log(`CarBridge FX ticker → ${url}`);
console.log(`  every ${intervalSec}s · jitter ${jitterOn ? "ON" : "OFF (rate may look static)"}`);
console.log("  Ctrl-C to stop.\n");

let ticks = 0;

async function tick() {
  const stamp = new Date().toLocaleTimeString();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log(`${stamp}  ✗ HTTP ${res.status}  ${body.error ?? ""}`);
      return;
    }
    ticks += 1;
    const eff = body.effectiveRate ?? "?";
    const raw = body.rawRate ?? "?";
    const src = body.source ?? "?";
    console.log(
      `${stamp}  #${ticks}  1 CAD ≈ ₦${eff}  (raw ${raw} · ${src})`,
    );
  } catch (e) {
    console.log(
      `${stamp}  ✗ ${e instanceof Error ? e.message : "request failed"} ` +
        `— is the web app running? (pnpm -F @carbridge/web dev)`,
    );
  }
}

await tick(); // fire once immediately
const timer = setInterval(tick, intervalSec * 1000);

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log(`\nStopped after ${ticks} successful tick(s).`);
  process.exit(0);
});
