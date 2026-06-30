"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtNGN } from "@/lib/format";
import type { AdminUserView, AdminMembershipInvoiceView } from "@/lib/types";

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
const opt: React.CSSProperties = { background: "#0B1413", color: "var(--frost)" };
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
  ISSUED: "var(--frost)", PART_PAID: "var(--amber)", PAID: "var(--stamp)",
  DRAFT: "var(--steel-dim)", VOID: "var(--steel-dim)",
};

function Badge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "var(--frost)";
  return (
    <span className="mono" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: tone, border: `1px solid ${tone}`, borderRadius: 6, padding: "2px 7px" }}>{status}</span>
  );
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

type PayForm = { amount: string; reference: string; note: string };

export function AdminMembers({
  users,
  invoices,
}: {
  users: AdminUserView[];
  invoices: AdminMembershipInvoiceView[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, PayForm>>({});

  const selected = users.find((u) => u.id === userId) ?? null;

  async function post(url: string, body: unknown, onOk: (j: Record<string, unknown>) => string) {
    setBusy(url);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((j.error as string) ?? "Request failed");
        return;
      }
      setNotice(onOk(j));
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  function grant() {
    if (!userId) { setError("Select a buyer first."); return; }
    post("/api/admin/memberships/grant", { userId }, (j) => `Premium granted - active until ${shortDate(String(j.expiresAt))}.`);
  }

  function issue() {
    if (!userId) { setError("Select a buyer first."); return; }
    if (!(Number(amount) > 0)) { setError("Enter a membership price."); return; }
    post("/api/admin/memberships/invoice", { userId, amount }, (j) => `Membership invoice ${String(j.number ?? "")} issued.`);
  }

  async function pay(invoiceId: string, f: PayForm) {
    if (!(Number(f.amount) > 0)) { setError("Enter a positive amount."); return; }
    if (!f.reference.trim()) { setError("A payment reference is required."); return; }
    setBusy(`pay-${invoiceId}`);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: f.amount, reference: f.reference.trim(), note: f.note.trim() || null }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) { setError((j.error as string) ?? "Could not record payment"); return; }
      setNotice(j.premiumGranted ? "Payment recorded - Premium granted." : "Payment recorded.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {error && <div className="mono" style={{ color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 12 }}>{error}</div>}
      {notice && <div className="mono" style={{ color: "var(--stamp)", border: "1px solid var(--stamp)", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 12 }}>{notice}</div>}

      {/* Grant / invoice panel */}
      <div style={card}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)", marginBottom: 12 }}>Grant or invoice Premium</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <div>
            <span style={label}>Buyer</span>
            <select style={input} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="" style={opt} disabled>Select a buyer…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id} style={opt}>
                  {(u.name ? `${u.name} · ` : "") + u.email}{u.tier === "PREMIUM" ? " (Premium)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={label}>Price (NGN)</span>
            <input style={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 45000" />
          </div>
        </div>

        {selected && (
          <div className="mono" style={{ fontSize: 11, color: "var(--steel-dim)", marginTop: 10 }}>
            {selected.tier === "PREMIUM" && selected.premiumExpiresAt
              ? `Currently Premium · expires ${shortDate(selected.premiumExpiresAt)} - a grant extends from there.`
              : "Currently not Premium - a grant runs one year from today."}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button style={primary} disabled={busy !== null} onClick={grant}>
            {busy?.includes("/grant") ? "Granting…" : "Grant Premium directly"}
          </button>
          <button style={ghost} disabled={busy !== null} onClick={issue}>
            {busy?.includes("/invoice") ? "Issuing…" : "Issue membership invoice"}
          </button>
        </div>
      </div>

      {/* Membership invoices */}
      <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--steel-dim)", margin: "22px 2px 12px" }}>
        Membership invoices · {invoices.length}
      </div>
      {invoices.length === 0 && <p style={{ color: "var(--steel-dim)", fontSize: 13, padding: "2px 2px" }}>No membership invoices yet.</p>}

      {invoices.map((inv) => {
        const remaining = Math.max(0, Number(inv.amountNGN) - Number(inv.amountPaidNGN)).toFixed(2);
        const f = forms[inv.id] ?? { amount: remaining, reference: "", note: "" };
        const setF = (patch: Partial<PayForm>) =>
          setForms((prev) => ({ ...prev, [inv.id]: { ...(prev[inv.id] ?? { amount: remaining, reference: "", note: "" }), ...patch } }));
        return (
          <div key={inv.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.buyer.name ?? inv.buyer.email}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--steel-dim)", marginTop: 3 }}>
                  {inv.number ?? inv.id.slice(0, 8)} · issued {shortDate(inv.createdAt)}{inv.dueAt && inv.status !== "PAID" ? ` · due ${shortDate(inv.dueAt)}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 14 }}>{fmtNGN(inv.amountNGN)}</div>
                <div style={{ marginTop: 4 }}><Badge status={inv.status} /></div>
              </div>
            </div>

            {inv.status === "PAID" ? (
              <p className="mono" style={{ fontSize: 12, color: "var(--stamp)", marginTop: 10 }}>✓ Paid in full · Premium granted</p>
            ) : (
              <div style={{ border: "1px solid var(--rule)", borderRadius: 10, padding: 12, marginTop: 12, background: "rgba(255,255,255,.015)" }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)", marginBottom: 10 }}>
                  Record bank payment · paid {fmtNGN(inv.amountPaidNGN)} / {fmtNGN(inv.amountNGN)}
                </div>
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
          </div>
        );
      })}
    </div>
  );
}
