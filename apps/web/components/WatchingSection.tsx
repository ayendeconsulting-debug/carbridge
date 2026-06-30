"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtNGN, fmtCAD } from "@/lib/format";
import type { WatchingItemView } from "@/lib/types";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const card: React.CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: 12,
  padding: "14px 15px",
  background: "rgba(255,255,255,.02)",
  marginBottom: 10,
};
const label: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "var(--steel-dim)",
  margin: "26px 2px 12px",
};

function chip(text: string, tone: string) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: tone,
        border: `1px solid ${tone}`,
        borderRadius: 6,
        padding: "2px 7px",
      }}
    >
      {text}
    </span>
  );
}

export function WatchingSection() {
  const [items, setItems] = useState<WatchingItemView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/favorites/watching");
      const d = await res.json();
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function unwatch(vehicleId: string) {
    setBusy(vehicleId);
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId }),
      });
      setItems((prev) => (prev ? prev.filter((i) => i.vehicleId !== vehicleId) : prev));
    } catch {
      /* leave it; next load reconciles */
    } finally {
      setBusy(null);
    }
  }

  if (items === null) {
    return (
      <>
        <div className="mono" style={label}>Watching</div>
        <p style={{ color: "var(--steel-dim)", fontSize: 13, padding: "4px 2px" }}>Loading…</p>
      </>
    );
  }

  return (
    <>
      <div className="mono" style={label}>Watching · {items.length}</div>
      {items.length === 0 && (
        <p style={{ color: "var(--steel-dim)", fontSize: 13, padding: "4px 2px" }}>
          Tap the heart on any vehicle to save it. We&rsquo;ll show price, FX and availability changes here.
        </p>
      )}
      {items.map((it) => {
        const moved = it.priceDropCAD || it.priceUpCAD || it.fxMoved || !it.available;
        return (
          <div key={it.vehicleId} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <Link href={`/vehicles/${it.vehicleId}`} style={{ fontWeight: 700, color: "var(--frost)", textDecoration: "none" }}>{it.name}</Link>
                <div className="mono" style={{ fontSize: 10, letterSpacing: 0.3, color: "var(--steel-dim)", marginTop: 4 }}>saved {shortDate(it.savedAt)}</div>
              </div>
              {it.current && (
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 14, color: "var(--frost)" }}>{fmtNGN(it.current.ngn)}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--steel-dim)" }}>{fmtCAD(it.current.cad)} CAD</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
              {!it.available && chip(it.statusNote ?? "Unavailable", "var(--steel-dim)")}
              {it.available && it.priceDropCAD && chip(`Price dropped ${fmtCAD(it.priceDropCAD)}`, "var(--stamp)")}
              {it.available && it.priceUpCAD && chip(`Price up ${fmtCAD(it.priceUpCAD)}`, "var(--amber)")}
              {it.available && it.fxMoved && chip("FX moved since saved", "var(--frost)")}
              {it.available && !moved && chip("Still available", "var(--steel-dim)")}
              <button
                onClick={() => unwatch(it.vehicleId)}
                disabled={busy === it.vehicleId}
                className="mono"
                style={{ marginLeft: "auto", fontSize: 11, background: "transparent", border: "1px solid var(--rule)", color: "var(--steel-dim)", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}
              >
                {busy === it.vehicleId ? "…" : "Unwatch"}
              </button>
            </div>

            {it.available && it.savedTotal && (it.priceDropCAD || it.priceUpCAD || it.fxMoved) && (
              <p className="mono" style={{ fontSize: 10, color: "var(--steel-dim)", marginTop: 8 }}>
                was {fmtNGN(it.savedTotal.ngn)} when you saved it
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
