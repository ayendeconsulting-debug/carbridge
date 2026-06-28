"use client";

import { useMemo, useState } from "react";
import { VehicleCard } from "./VehicleCard";
import type { FxView, VehicleCardView } from "@/lib/types";

type Sort = "newest" | "priceUp" | "priceDown" | "mileage";

export function GalleryGrid({ cards, fx }: { cards: VehicleCardView[]; fx: FxView }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = cards.filter((c) =>
      needle === ""
        ? true
        : `${c.make} ${c.model} ${c.year} ${c.trim ?? ""} ${c.bodyType}`
            .toLowerCase()
            .includes(needle),
    );
    list = [...list];
    if (sort === "priceUp") list.sort((a, b) => Number(a.purchasePriceCAD) - Number(b.purchasePriceCAD));
    else if (sort === "priceDown") list.sort((a, b) => Number(b.purchasePriceCAD) - Number(a.purchasePriceCAD));
    else if (sort === "mileage") list.sort((a, b) => a.mileageKm - b.mileageKm);
    return list;
  }, [cards, q, sort]);

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
      </div>

      {shown.length === 0 ? (
        <p style={{ color: "var(--steel-dim)", padding: "24px 4px" }}>
          No vehicles match “{q}”. Try a different search.
        </p>
      ) : (
        <div className="grid">
          {shown.map((c) => (
            <VehicleCard key={c.id} v={c} fx={fx} />
          ))}
        </div>
      )}
    </div>
  );
}
