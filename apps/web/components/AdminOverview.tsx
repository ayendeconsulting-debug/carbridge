"use client";

import { fmtNGN } from "@/lib/format";
import type {
  AdminOfferView,
  AdminReservationView,
  AdminCarRequestView,
  AdminVehicleListItem,
  AdminBillingRow,
  AdminMembershipInvoiceView,
} from "@/lib/types";

export type AdminTabKey = "overview" | "catalog" | "responses" | "billing" | "members";

type Tone = "amber" | "stamp" | "frost";

function Tile({
  label,
  value,
  sub,
  tone = "frost",
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
  onClick?: () => void;
}) {
  const color = tone === "amber" ? "var(--amber)" : tone === "stamp" ? "var(--stamp)" : "var(--frost)";
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        textAlign: "left",
        background: "rgba(255,255,255,.02)",
        border: "1px solid var(--rule)",
        borderRadius: 12,
        padding: 14,
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <span className="mono" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)" }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "var(--mono, monospace)", lineHeight: 1 }}>{value}</span>
      {sub && <span className="mono" style={{ fontSize: 10, color: "var(--steel-dim)" }}>{sub}</span>}
    </button>
  );
}

function Section({ title, children, columns }: { title: string; children: React.ReactNode; columns?: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--steel-dim)", margin: "0 2px 10px" }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: columns ?? "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>{children}</div>
    </div>
  );
}

export function AdminOverview({
  offers,
  reservations,
  carRequests,
  vehicles,
  billing,
  memberships,
  onNavigate,
}: {
  offers: AdminOfferView[];
  reservations: AdminReservationView[];
  carRequests: AdminCarRequestView[];
  vehicles: AdminVehicleListItem[];
  billing: AdminBillingRow[];
  memberships: AdminMembershipInvoiceView[];
  onNavigate: (tab: AdminTabKey) => void;
}) {
  const pendingOffers = offers.filter((o) => o.status === "SUBMITTED" || o.status === "COUNTERED").length;
  const pendingReservations = reservations.filter((r) => r.status === "PENDING").length;
  const requestsToMatch = carRequests.filter((r) => r.status === "SUBMITTED").length;

  const awaitingQuote = billing.filter(
    (b) => (b.reservationStatus === "PENDING" || b.reservationStatus === "CONFIRMED") && !b.quotation,
  ).length;
  const awaitingInvoice = billing.filter((b) => !!b.quotation && !b.invoice).length;
  const awaitingPayment = billing.filter((b) => !!b.invoice && b.invoice.status !== "PAID").length;
  const unpaidMembership = memberships.filter((m) => m.status !== "PAID" && m.status !== "VOID").length;

  const vBy = (s: string) => vehicles.filter((v) => v.status === s).length;

  const carReceived = billing.reduce((s, b) => s + (b.invoice ? Number(b.invoice.amountPaidNGN) || 0 : 0), 0);
  const memberReceived = memberships.reduce((s, m) => s + (Number(m.amountPaidNGN) || 0), 0);

  const act = (n: number): Tone => (n > 0 ? "amber" : "frost");

  return (
    <div>
      <Section title="Needs action">
        <Tile label="Pending offers" value={pendingOffers} tone={act(pendingOffers)} sub="review in Responses" onClick={() => onNavigate("responses")} />
        <Tile label="Reservations pending" value={pendingReservations} tone={act(pendingReservations)} sub="confirm in Responses" onClick={() => onNavigate("responses")} />
        <Tile label="Requests to match" value={requestsToMatch} tone={act(requestsToMatch)} sub="source-a-car" onClick={() => onNavigate("responses")} />
        <Tile label="Awaiting quote" value={awaitingQuote} tone={act(awaitingQuote)} sub="issue in Billing" onClick={() => onNavigate("billing")} />
        <Tile label="Awaiting invoice" value={awaitingInvoice} tone={act(awaitingInvoice)} sub="issue in Billing" onClick={() => onNavigate("billing")} />
        <Tile label="Awaiting payment" value={awaitingPayment} tone={act(awaitingPayment)} sub="record in Billing" onClick={() => onNavigate("billing")} />
        <Tile label="Membership unpaid" value={unpaidMembership} tone={act(unpaidMembership)} sub="record in Members" onClick={() => onNavigate("members")} />
      </Section>

      <Section title="Inventory">
        <Tile label="Draft" value={vBy("DRAFT")} sub="manage in Catalog" onClick={() => onNavigate("catalog")} />
        <Tile label="Available" value={vBy("AVAILABLE")} tone="stamp" sub="live listings" onClick={() => onNavigate("catalog")} />
        <Tile label="Reserved" value={vBy("RESERVED")} sub="in commerce" onClick={() => onNavigate("catalog")} />
        <Tile label="Sold" value={vBy("SOLD")} sub="completed" onClick={() => onNavigate("catalog")} />
      </Section>

      <Section title="Payments received" columns="1fr">
        <Tile label="Cars (₦)" value={fmtNGN(carReceived)} tone="stamp" sub="recorded to date" onClick={() => onNavigate("billing")} />
        <Tile label="Membership (₦)" value={fmtNGN(memberReceived)} tone="stamp" sub="recorded to date" onClick={() => onNavigate("members")} />
      </Section>
    </div>
  );
}
