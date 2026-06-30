"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { VehicleCard } from "./VehicleCard";
import { TRANSMISSIONS, FUEL_TYPES, TRANSMISSION_LABEL, FUEL_LABEL } from "@/lib/vehicle-spec";
import type { FxView, VehicleCardView } from "@/lib/types";

type Sort = "newest" | "priceUp" | "priceDown" | "mileage";

export function GalleryGrid({ cards, fx, favoritedIds = [] }: { cards: VehicleCardView[]; fx: FxView; favoritedIds?: string[] }) {
  const favSet = useMemo(() => new Set(favoritedIds), [favoritedIds]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [trans, setTrans] = useState<string>("ALL");
  const [fuel, setFuel] = useState<string>("ALL");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = cards.filter((c) => {
      if (needle !== "" &&
        !`${c.make} ${c.model} ${c.year} ${c.trim ?? ""} ${c.bodyType}`
          .toLowerCase()
          .includes(needle)
      ) return false;
      if (trans !== "ALL" && c.transmission !== trans) return false;
      if (fuel !== "ALL" && c.fuelType !== fuel) return false;
      return true;
    });
    list = [...list];
    if (sort === "priceUp") list.sort((a, b) => Number(a.purchasePriceCAD) - Number(b.purchasePriceCAD));
    else if (sort === "priceDown") list.sort((a, b) => Number(b.purchasePriceCAD) - Number(a.purchasePriceCAD));
    else if (sort === "mileage") list.sort((a, b) => a.mileageKm - b.mileageKm);
    return list;
  }, [cards, q, sort, trans, fuel]);

  return (
    <div className="gwrap">
      <div className="ghead">
        <h2 className="exp">Inventory</h2>
        <span className="cnt">{shown.length} vehicles · landed</span>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "0 4px 18px", flexWrap: "wrap" }}>
        <input
          className="mono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search make, model, year…"
          style={{
            flex: 1,
            minWidth: 180,
            background: "rgba(255,255,255,.03)",
            border: "1px solid var(--rule)",
            borderRadius: 9,
            color: "var(--frost)",
            padding: "11px 13px",
            fontSize: 13,
          }}
        />
        <select
          className="mono"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          style={{
            background: "rgba(255,255,255,.03)",
            border: "1px solid var(--rule)",
            borderRadius: 9,
            color: "var(--steel)",
            padding: "11px 13px",
            fontSize: 12,
          }}
        >
          <option value="newest">Newest</option>
          <option value="priceUp">Price ↑</option>
          <option value="priceDown">Price ↓</option>
          <option value="mileage">Mileage ↑</option>
        </select>
        <select
          className="mono"
          value={trans}
          onChange={(e) => setTrans(e.target.value)}
          style={{
            background: "rgba(255,255,255,.03)",
            border: "1px solid var(--rule)",
            borderRadius: 9,
            color: "var(--steel)",
            padding: "11px 13px",
            fontSize: 12,
            colorScheme: "dark",
          }}
        >
          <option value="ALL">All transmissions</option>
          {TRANSMISSIONS.map((t) => <option key={t} value={t}>{TRANSMISSION_LABEL[t]}</option>)}
        </select>
        <select
          className="mono"
          value={fuel}
          onChange={(e) => setFuel(e.target.value)}
          style={{
            background: "rgba(255,255,255,.03)",
            border: "1px solid var(--rule)",
            borderRadius: 9,
            color: "var(--steel)",
            padding: "11px 13px",
            fontSize: 12,
            colorScheme: "dark",
          }}
        >
          <option value="ALL">All fuels</option>
          {FUEL_TYPES.map((f) => <option key={f} value={f}>{FUEL_LABEL[f]}</option>)}
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="hcard" style={{ padding: 24, textAlign: "center", marginTop: 8 }}>
          <p style={{ color: "var(--steel)", marginBottom: 14 }}>
            No vehicles match your search and filters. We can source it for you instead - tell us the spec and your budget, and our team hunts the Canadian market.
          </p>
          <Link href="/requests/new" className="btn btn-buy" style={{ display: "inline-block" }}>Source this car →</Link>
        </div>
      ) : (
        <div className="grid">
          {shown.map((c) => (
            <VehicleCard key={c.id} v={c} fx={fx} favorited={favSet.has(c.id)} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, borderTop: "1px solid var(--rule)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: "var(--steel)", fontSize: 13 }}>Can't find the exact car? Our team will source it from Canada to your budget.</span>
        <Link href="/requests/new" className="mono" style={{ color: "var(--amber)", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Source a car →</Link>
      </div>
    </div>
  );
}
