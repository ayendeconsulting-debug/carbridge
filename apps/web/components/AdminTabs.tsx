"use client";

import { useState } from "react";
import { AdminConsole } from "./AdminConsole";
import { AdminCatalog } from "./AdminCatalog";
import type {
  AdminOfferView,
  AdminReservationView,
  AdminCarRequestView,
  VehicleOption,
  AdminVehicleListItem,
} from "@/lib/types";

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--amber)" : "2px solid transparent",
        color: active ? "var(--frost)" : "var(--steel-dim)",
        padding: "10px 4px",
        marginBottom: -1,
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function AdminTabs({
  offers,
  reservations,
  carRequests,
  matchable,
  vehicles,
}: {
  offers: AdminOfferView[];
  reservations: AdminReservationView[];
  carRequests: AdminCarRequestView[];
  matchable: VehicleOption[];
  vehicles: AdminVehicleListItem[];
}) {
  const [tab, setTab] = useState<"catalog" | "responses">("catalog");

  const pending =
    offers.filter((o) => o.status === "SUBMITTED" || o.status === "COUNTERED").length +
    reservations.filter((r) => r.status === "PENDING").length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--steel-dim)" }}>
        CarBridge · Operations
      </div>

      <div style={{ display: "flex", gap: 18, margin: "12px 0 20px", borderBottom: "1px solid var(--rule)" }}>
        <TabBtn active={tab === "catalog"} onClick={() => setTab("catalog")}>Catalog</TabBtn>
        <TabBtn active={tab === "responses"} onClick={() => setTab("responses")}>
          Responses{pending > 0 ? ` (${pending})` : ""}
        </TabBtn>
      </div>

      {tab === "catalog" ? (
        <AdminCatalog vehicles={vehicles} />
      ) : (
        <AdminConsole
          offers={offers}
          reservations={reservations}
          carRequests={carRequests}
          matchable={matchable}
        />
      )}
    </div>
  );
}
