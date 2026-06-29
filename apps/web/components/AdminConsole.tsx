"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtNGN, fmtCAD } from "@/lib/format";
import { ADMIN_COOKIE } from "@/lib/constants";
import type {
  AdminOfferView,
  AdminReservationView,
  AdminCarRequestView,
  VehicleOption,
  CarWishlist,
  Currency,
} from "@/lib/types";

function wishlistLabel(w: CarWishlist): string {
  const years = w.yearMin || w.yearMax ? `${w.yearMin ?? "?"}–${w.yearMax ?? "?"}` : "";
  const makeModel = [w.make, w.model].filter(Boolean).join(" ");
  const km = w.maxMileageKm ? `≤${w.maxMileageKm.toLocaleString()} km` : "";
  const parts = [years, makeModel || "Any vehicle", w.bodyType, km].filter(Boolean);
  return parts.join(" · ");
}

const fmt = (amount: string, currency: Currency) =>
  currency === "NGN" ? fmtNGN(amount) : fmtCAD(amount);

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: "var(--amber)",
  COUNTERED: "var(--amber)",
  PENDING: "var(--amber)",
  ACCEPTED: "var(--stamp)",
  CONFIRMED: "var(--stamp)",
  DECLINED: "var(--steel-dim)",
  CANCELLED: "var(--steel-dim)",
  EXPIRED: "var(--steel-dim)",
};

function Badge({ status }: { status: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 9, letterSpacing: 1, textTransform: "uppercase",
        color: STATUS_TONE[status] ?? "var(--frost)",
        border: `1px solid ${STATUS_TONE[status] ?? "var(--rule)"}`,
        borderRadius: 6, padding: "2px 7px",
      }}
    >
      {status}
    </span>
  );
}

export function AdminConsole({
  offers,
  reservations,
  carRequests,
  matchable,
}: {
  offers: AdminOfferView[];
  reservations: AdminReservationView[];
  carRequests: AdminCarRequestView[];
  matchable: VehicleOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterCurrency, setCounterCurrency] = useState<Currency>("NGN");

  // car-request match form state
  const [matchFor, setMatchFor] = useState<string | null>(null);
  const [matchVehicle, setMatchVehicle] = useState("");
  const [matchNote, setMatchNote] = useState("");

  const exitAdmin = () => {
    document.cookie = `${ADMIN_COOKIE}=; path=/; max-age=0`;
    router.refresh();
  };

  const act = async (
    kind: "offers" | "reservations" | "car-requests",
    id: string,
    payload: Record<string, unknown>,
  ) => {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/${kind}/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ id, text: data.error ?? "Action failed" });
        return;
      }
      setCounterFor(null);
      setMatchFor(null);
      router.refresh();
    } catch {
      setMsg({ id, text: "Network error — try again" });
    } finally {
      setBusy(null);
    }
  };

  const submitCounter = (id: string) => {
    if (!(Number(counterAmount) > 0)) {
      setMsg({ id, text: "Enter a counter amount greater than zero" });
      return;
    }
    act("offers", id, { action: "counter", amount: counterAmount, currency: counterCurrency });
  };

  const submitMatch = (id: string) => {
    if (!matchVehicle) {
      setMsg({ id, text: "Pick a vehicle to match" });
      return;
    }
    act("car-requests", id, { action: "match", vehicleId: matchVehicle, note: matchNote });
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0 6px" }}>
        <div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--steel-dim)" }}>Ayende Autos · Operations</div>
          <h1 className="exp" style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>Admin console</h1>
        </div>
        <button className="mono" onClick={exitAdmin} style={{ background: "transparent", border: "1px solid var(--rule)", borderRadius: 8, padding: "7px 11px", fontSize: 11, color: "var(--steel)", cursor: "pointer" }}>
          Exit admin
        </button>
      </div>

      <SectionLabel>Offers · {offers.length}</SectionLabel>
      {offers.length === 0 && <Empty>No offers yet.</Empty>}
      {offers.map((o) => {
        const open = o.status === "SUBMITTED" || o.status === "COUNTERED";
        const isBusy = busy === o.id;
        return (
          <div key={o.id} style={cardStyle}>
            <div style={rowTop}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--frost)" }}>{o.vehicle.name}</div>
                <div className="mono" style={metaStyle}>{o.buyer.name ?? o.buyer.email} · {o.shippingMethod} · {shortDate(o.createdAt)}</div>
              </div>
              <Badge status={o.status} />
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "10px 0 2px" }}>
              <Field k="Offer">{fmt(o.amount, o.currency)}</Field>
              {o.listedTotal && <Field k="Listed">{fmtNGN(o.listedTotal.ngn)}</Field>}
              {o.counter && <Field k="Countered">{fmt(o.counter.amount, o.counter.currency)}</Field>}
              <Field k="Rate lock" tone={o.rateExpired ? "dim" : undefined}>
                {o.rateExpiresAt ? (o.rateExpired ? "expired" : `holds ${shortDate(o.rateExpiresAt)}`) : "—"}
              </Field>
            </div>

            {msg?.id === o.id && <p style={errStyle}>{msg.text}</p>}

            {open && counterFor === o.id ? (
              <div style={{ marginTop: 12 }}>
                <div className="seg" style={{ marginBottom: 8, maxWidth: 220 }}>
                  {(["NGN", "CAD"] as Currency[]).map((c) => (
                    <button key={c} className={counterCurrency === c ? "on" : ""} onClick={() => setCounterCurrency(c)}>{c === "NGN" ? "₦" : "$"} {c}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    inputMode="decimal"
                    value={counterAmount}
                    onChange={(e) => setCounterAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Counter amount"
                    style={inputStyle}
                  />
                  <button className="btn btn-buy" disabled={isBusy} onClick={() => submitCounter(o.id)}>{isBusy ? "…" : "Send"}</button>
                  <button className="btn" disabled={isBusy} onClick={() => setCounterFor(null)} style={ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : open ? (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-buy" disabled={isBusy} onClick={() => act("offers", o.id, { action: "accept" })}>Accept</button>
                {o.status === "SUBMITTED" && (
                  <button className="btn" disabled={isBusy} onClick={() => { setCounterFor(o.id); setCounterAmount(o.listedTotal?.ngn ?? ""); setCounterCurrency("NGN"); setMsg(null); }} style={ghostBtn}>Counter</button>
                )}
                <button className="btn" disabled={isBusy} onClick={() => act("offers", o.id, { action: "decline" })} style={dangerBtn}>Decline</button>
              </div>
            ) : null}
          </div>
        );
      })}

      <SectionLabel>Reservations · {reservations.length}</SectionLabel>
      {reservations.length === 0 && <Empty>No reservations yet.</Empty>}
      {reservations.map((r) => {
        const isBusy = busy === r.id;
        const canConfirm = r.status === "PENDING";
        const canCancel = r.status === "PENDING" || r.status === "CONFIRMED";
        return (
          <div key={r.id} style={cardStyle}>
            <div style={rowTop}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--frost)" }}>{r.vehicle.name}</div>
                <div className="mono" style={metaStyle}>{r.buyer.name ?? r.buyer.email} · {r.shippingMethod} · {shortDate(r.createdAt)}</div>
              </div>
              <Badge status={r.status} />
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "10px 0 2px" }}>
              <Field k="Locked total">{fmtNGN(r.lockedTotalNGN)}</Field>
              <Field k="≈ CAD">{fmtCAD(r.lockedTotalCAD)}</Field>
              <Field k="Holds" tone={r.expired ? "dim" : undefined}>
                {r.expiresAt ? (r.expired ? "expired" : `until ${shortDate(r.expiresAt)}`) : "—"}
              </Field>
            </div>

            {msg?.id === r.id && <p style={errStyle}>{msg.text}</p>}

            {(canConfirm || canCancel) && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {canConfirm && <button className="btn btn-buy" disabled={isBusy} onClick={() => act("reservations", r.id, { action: "confirm" })}>Confirm → Sold</button>}
                {canCancel && <button className="btn" disabled={isBusy} onClick={() => act("reservations", r.id, { action: "cancel" })} style={dangerBtn}>Cancel</button>}
              </div>
            )}
          </div>
        );
      })}

      <SectionLabel>Car requests · {carRequests.length}</SectionLabel>
      {carRequests.length === 0 && <Empty>No source-a-car requests yet.</Empty>}
      {carRequests.map((cr) => {
        const isBusy = busy === cr.id;
        const open = cr.status === "SUBMITTED" || cr.status === "IN_REVIEW";
        const canDecline = open || cr.status === "MATCHED";
        return (
          <div key={cr.id} style={cardStyle}>
            <div style={rowTop}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--frost)" }}>{wishlistLabel(cr.wishlist)}</div>
                <div className="mono" style={metaStyle}>{cr.buyer.name ?? cr.buyer.email} · {shortDate(cr.createdAt)}</div>
              </div>
              <Badge status={cr.status} />
            </div>

            <div style={fieldRow}>
              <Field k="Budget">{fmt(cr.budget.amount, cr.budget.currency)}</Field>
              {cr.matched && <Field k="Matched">{cr.matched.name}</Field>}
            </div>
            {cr.notes && <p className="mono" style={{ fontSize: 11, color: "var(--steel)", marginTop: 8 }}>“{cr.notes}”</p>}
            {cr.adminNote && <p className="mono" style={{ fontSize: 11, color: "var(--stamp)", marginTop: 6 }}>Note to buyer: {cr.adminNote}</p>}

            {msg?.id === cr.id && <p style={errStyle}>{msg.text}</p>}

            {open && matchFor === cr.id ? (
              <div style={{ marginTop: 12 }}>
                <select
                  value={matchVehicle}
                  onChange={(e) => setMatchVehicle(e.target.value)}
                  style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
                >
                  <option value="">Select a vehicle…</option>
                  {matchable.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <input
                  value={matchNote}
                  onChange={(e) => setMatchNote(e.target.value)}
                  placeholder="Note to buyer (optional)"
                  style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-buy" disabled={isBusy} onClick={() => submitMatch(cr.id)}>{isBusy ? "…" : "Confirm match"}</button>
                  <button className="btn" disabled={isBusy} onClick={() => setMatchFor(null)} style={ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {open && <button className="btn btn-buy" disabled={isBusy} onClick={() => { setMatchFor(cr.id); setMatchVehicle(""); setMatchNote(""); setMsg(null); }}>Match a vehicle</button>}
                {canDecline && <button className="btn" disabled={isBusy} onClick={() => act("car-requests", cr.id, { action: "decline" })} style={dangerBtn}>Decline</button>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--steel-dim)", margin: "26px 2px 12px" }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--steel-dim)", fontSize: 13, padding: "4px 2px" }}>{children}</p>;
}
function Field({ k, children, tone }: { k: string; children: React.ReactNode; tone?: "dim" }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)" }}>{k}</div>
      <div className="mono" style={{ fontSize: 14, color: tone === "dim" ? "var(--steel-dim)" : "var(--frost)", marginTop: 3 }}>{children}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { border: "1px solid var(--rule)", borderRadius: 12, padding: "14px 15px", background: "rgba(255,255,255,.02)", marginBottom: 10 };
const rowTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 };
const fieldRow: React.CSSProperties = { display: "flex", gap: 18, flexWrap: "wrap", margin: "10px 0 2px" };
const metaStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 0.3, color: "var(--steel-dim)", marginTop: 4 };
const errStyle: React.CSSProperties = { color: "var(--amber)", fontSize: 12, marginTop: 10 };
const inputStyle: React.CSSProperties = { flex: 1, padding: "10px 12px", background: "rgba(255,255,255,.03)", border: "1px solid var(--rule)", borderRadius: 9, color: "var(--frost)", fontFamily: "var(--mono, monospace)", fontSize: 15 };
const ghostBtn: React.CSSProperties = { background: "transparent", border: "1px solid var(--rule)", color: "var(--steel)" };
const dangerBtn: React.CSSProperties = { background: "transparent", border: "1px solid var(--amber)", color: "var(--amber)" };
