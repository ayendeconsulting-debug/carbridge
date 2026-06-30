"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtNGN, fmtCAD } from "@/lib/format";
import type { AdminBillingRow } from "@/lib/types";

const card: React.CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 14,
  background: "rgba(255,255,255,.02)",
};
const input: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,.03)",
  border: "1px solid var(--rule)",
  borderRadius: 8,
  color: "var(--frost)",
  padding: "9px 11px",
  fontSize: 13,
  colorScheme: "dark",
};
const label: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "var(--steel-dim)",
  marginBottom: 5,
  display: "block",
};
const primary: React.CSSProperties = {
  background: "var(--amber)",
  color: "#0B1413",
  border: "none",
  borderRadius: 8,
  padding: "9px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const ghost: React.CSSProperties = {
  background: "transparent",
  color: "var(--frost)",
  border: "1px solid var(--rule)",
  borderRadius: 8,
  padding: "9px 14px",
  fontSize: 12,
  cursor: "pointer",
};

const STATUS_TONE: Record<string, string> = {
  ISSUED: "var(--frost)",
  ACCEPTED: "var(--stamp)",
  PART_PAID: "var(--amber)",
  PAID: "var(--stamp)",
  DRAFT: "var(--steel-dim)",
  VOID: "var(--steel-dim)",
  PENDING: "var(--amber)",
  CONFIRMED: "var(--stamp)",
  CANCELLED: "var(--steel-dim)",
  EXPIRED: "var(--steel-dim)",
};

function Badge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "var(--frost)";
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
      {status}
    </span>
  );
}

function Step({ label: l, on }: { label: string; on: boolean }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: on ? "var(--frost)" : "var(--steel-dim)",
        opacity: on ? 1 : 0.6,
      }}
    >
      {on ? "●" : "○"} {l}
    </span>
  );
}

type PayForm = { amount: string; reference: string; note: string };

export function AdminBilling({ billing }: { billing: AdminBillingRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, PayForm>>({});

  async function call(url: string, okMsg: string) {
    setBusy(url);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error ?? "Request failed");
        return;
      }
      setNotice(okMsg);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function pay(invoiceId: string, f: PayForm) {
    if (!(Number(f.amount) > 0)) {
      setError("Enter a positive amount.");
      return;
    }
    if (!f.reference.trim()) {
      setError("A payment reference is required.");
      return;
    }
    setBusy(`pay-${invoiceId}`);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: f.amount, reference: f.reference.trim(), note: f.note.trim() || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error ?? "Could not record payment");
        return;
      }
      const advanced = (j as { reservationAdvanced?: boolean }).reservationAdvanced;
      setNotice(advanced ? "Payment recorded — paid in full, vehicle marked SOLD." : "Payment recorded.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  if (billing.length === 0) {
    return <p style={{ color: "var(--steel-dim)", padding: "8px 4px" }}>No reservations yet. Billing starts once a buyer reserves a vehicle.</p>;
  }

  return (
    <div>
      {error && <div className="mono" style={{ color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 12 }}>{error}</div>}
      {notice && <div className="mono" style={{ color: "var(--stamp)", border: "1px solid var(--stamp)", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 12 }}>{notice}</div>}

      {billing.map((row) => {
        const q = row.quotation;
        const inv = row.invoice;
        const reservationActive = row.reservationStatus === "PENDING" || row.reservationStatus === "CONFIRMED";
        const remaining = inv ? Math.max(0, Number(inv.amountNGN) - Number(inv.amountPaidNGN)).toFixed(2) : "0";
        const f = forms[inv?.id ?? ""] ?? { amount: remaining, reference: "", note: "" };
        const setF = (patch: Partial<PayForm>) =>
          inv && setForms((prev) => ({ ...prev, [inv.id]: { ...(prev[inv.id] ?? { amount: remaining, reference: "", note: "" }), ...patch } }));

        return (
          <div key={row.reservationId} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{row.vehicle.name}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--steel-dim)", marginTop: 3 }}>
                  {row.buyer.name ?? row.buyer.email} · {row.shippingMethod}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 15, color: "var(--frost)" }}>{fmtNGN(row.lockedTotalNGN)}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--steel-dim)" }}>{fmtCAD(row.lockedTotalCAD)} CAD · locked</div>
              </div>
            </div>

            {/* pipeline */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "12px 0 4px", flexWrap: "wrap" }}>
              <Step label="Reserved" on={true} />
              <span style={{ color: "var(--steel-dim)" }}>→</span>
              <Step label="Quoted" on={!!q} />
              <span style={{ color: "var(--steel-dim)" }}>→</span>
              <Step label="Accepted" on={q?.status === "ACCEPTED" || !!inv} />
              <span style={{ color: "var(--steel-dim)" }}>→</span>
              <Step label="Invoiced" on={!!inv} />
              <span style={{ color: "var(--steel-dim)" }}>→</span>
              <Step label="Paid" on={inv?.status === "PAID"} />
              <span style={{ marginLeft: "auto" }}><Badge status={row.reservationStatus} /></span>
            </div>

            {/* document refs */}
            {(q || inv) && (
              <div className="mono" style={{ fontSize: 11, color: "var(--steel)", display: "flex", gap: 16, flexWrap: "wrap", margin: "6px 0 2px" }}>
                {q && <span>Quote {q.number ?? q.id.slice(0, 8)} · <Badge status={q.status} /></span>}
                {inv && (
                  <span>
                    Invoice {inv.number ?? inv.id.slice(0, 8)} · <Badge status={inv.status} /> · paid {fmtNGN(inv.amountPaidNGN)} / {fmtNGN(inv.amountNGN)}
                  </span>
                )}
              </div>
            )}

            {/* contextual action */}
            <div style={{ marginTop: 12 }}>
              {!q && reservationActive && (
                <button style={primary} disabled={busy !== null} onClick={() => call(`/api/admin/reservations/${row.reservationId}/quote`, "Quotation issued.")}>
                  {busy?.includes("/quote") ? "Issuing…" : "Issue quote"}
                </button>
              )}

              {!q && !reservationActive && (
                <span className="mono" style={{ fontSize: 11, color: "var(--steel-dim)" }}>Reservation {row.reservationStatus.toLowerCase()} — nothing to bill.</span>
              )}

              {q && !inv && q.status === "ACCEPTED" && (
                <button style={primary} disabled={busy !== null} onClick={() => call(`/api/admin/quotations/${q.id}/invoice`, "Invoice issued.")}>
                  {busy?.includes("/invoice") ? "Issuing…" : "Issue invoice"}
                </button>
              )}

              {q && !inv && q.status !== "ACCEPTED" && (
                <span className="mono" style={{ fontSize: 11, color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: 6, padding: "4px 9px" }}>
                  Awaiting buyer acceptance
                </span>
              )}

              {inv && inv.status !== "PAID" && (
                <div style={{ border: "1px solid var(--rule)", borderRadius: 10, padding: 12, background: "rgba(255,255,255,.015)" }}>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)", marginBottom: 10 }}>Record bank payment</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <span style={label}>Amount (NGN)</span>
                      <input style={input} inputMode="decimal" value={f.amount} onChange={(e) => setF({ amount: e.target.value })} />
                    </div>
                    <div>
                      <span style={label}>Bank reference</span>
                      <input style={input} value={f.reference} onChange={(e) => setF({ reference: e.target.value })} placeholder="transfer ref" />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span style={label}>Note (optional)</span>
                    <input style={input} value={f.note} onChange={(e) => setF({ note: e.target.value })} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                    <button style={primary} disabled={busy !== null} onClick={() => pay(inv.id, f)}>
                      {busy === `pay-${inv.id}` ? "Recording…" : "Record payment"}
                    </button>
                    <span className="mono" style={{ fontSize: 11, color: "var(--steel-dim)" }}>remaining {fmtNGN(remaining)}</span>
                  </div>
                </div>
              )}

              {inv && inv.status === "PAID" && (
                <span className="mono" style={{ fontSize: 12, color: "var(--stamp)" }}>✓ Paid in full · vehicle SOLD</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
