"use client";

import { useState } from "react";
import { AdminConsole } from "./AdminConsole";
import { AdminCatalog } from "./AdminCatalog";
import { AdminBilling } from "./AdminBilling";
import { AdminMembers } from "./AdminMembers";
import { AdminOverview, type AdminTabKey } from "./AdminOverview";
import type {
  AdminOfferView,
  AdminReservationView,
  AdminCarRequestView,
  VehicleOption,
  AdminVehicleListItem,
  AdminBillingRow,
  AdminUserView,
  AdminMembershipInvoiceView,
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
  billing,
  users,
  memberships,
}: {
  offers: AdminOfferView[];
  reservations: AdminReservationView[];
  carRequests: AdminCarRequestView[];
  matchable: VehicleOption[];
  vehicles: AdminVehicleListItem[];
  billing: AdminBillingRow[];
  users: AdminUserView[];
  memberships: AdminMembershipInvoiceView[];
}) {
  const [tab, setTab] = useState<AdminTabKey>("overview");

  const pending =
    offers.filter((o) => o.status === "SUBMITTED" || o.status === "COUNTERED").length +
    reservations.filter((r) => r.status === "PENDING").length;

  // Billing rows with an outstanding action: active reservation not yet paid in full.
  const billingTodo = billing.filter((b) => {
    const active = b.reservationStatus === "PENDING" || b.reservationStatus === "CONFIRMED";
    return active && b.invoice?.status !== "PAID";
  }).length;

  // Membership invoices awaiting payment.
  const membersTodo = memberships.filter((m) => m.status !== "PAID" && m.status !== "VOID").length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--steel-dim)" }}>
        Ayende Autos · Operations
      </div>

      <div style={{ display: "flex", gap: 18, margin: "12px 0 20px", borderBottom: "1px solid var(--rule)" }}>
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabBtn>
        <TabBtn active={tab === "catalog"} onClick={() => setTab("catalog")}>Catalog</TabBtn>
        <TabBtn active={tab === "responses"} onClick={() => setTab("responses")}>
          Responses{pending > 0 ? ` (${pending})` : ""}
        </TabBtn>
        <TabBtn active={tab === "billing"} onClick={() => setTab("billing")}>
          Billing{billingTodo > 0 ? ` (${billingTodo})` : ""}
        </TabBtn>
        <TabBtn active={tab === "members"} onClick={() => setTab("members")}>
          Members{membersTodo > 0 ? ` (${membersTodo})` : ""}
        </TabBtn>
      </div>

      {tab === "overview" ? (
        <AdminOverview
          offers={offers}
          reservations={reservations}
          carRequests={carRequests}
          vehicles={vehicles}
          billing={billing}
          memberships={memberships}
          onNavigate={setTab}
        />
      ) : tab === "catalog" ? (
        <AdminCatalog vehicles={vehicles} />
      ) : tab === "responses" ? (
        <AdminConsole
          offers={offers}
          reservations={reservations}
          carRequests={carRequests}
          matchable={matchable}
        />
      ) : tab === "billing" ? (
        <AdminBilling billing={billing} />
      ) : (
        <AdminMembers users={users} invoices={memberships} />
      )}
    </div>
  );
}
