"use client";

import { useState } from "react";
import { useFxRate } from "./useFxRate";
import { fmtCAD, fmtNGN } from "@/lib/format";
import type { FxView } from "@/lib/types";

const BODY_TYPES = ["SUV", "SEDAN", "HATCHBACK", "WAGON", "COUPE", "TRUCK", "VAN", "OTHER"];

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.03)",
  border: "1px solid var(--rule)",
  borderRadius: 9,
  color: "var(--frost)",
  padding: "11px 13px",
  fontSize: 14,
  width: "100%",
};
const labelStyle: React.CSSProperties = {
  fontFamily: "'Spline Sans Mono', monospace",
  fontSize: 9,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "var(--steel-dim)",
  display: "block",
  margin: "0 0 6px 2px",
};

export function SourceACarForm({ fx, defaults }: { fx: FxView; defaults?: { make?: string; model?: string } }) {
  const live = useFxRate(fx);
  const rate = Number(live.effectiveRate);
  const [currency, setCurrency] = useState<"NGN" | "CAD">("NGN");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amt = Number(amount);
  const converted =
    amt > 0 && rate > 0
      ? currency === "NGN"
        ? `≈ ${fmtCAD(amt / rate)}`
        : `≈ ${fmtNGN(amt * rate)}`
      : null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const budgetAmount = String(f.get("budgetAmount") ?? "").trim();
    if (!budgetAmount || Number(budgetAmount) <= 0) {
      setError("Enter a budget amount to submit your request.");
      return;
    }
    const payload = {
      make: str(f.get("make")),
      model: str(f.get("model")),
      yearMin: num(f.get("yearMin")),
      yearMax: num(f.get("yearMax")),
      bodyType: str(f.get("bodyType")),
      maxMileageKm: num(f.get("maxMileageKm")),
      budgetAmount,
      budgetCurrency: currency,
      notes: str(f.get("notes")),
    };
    setBusy(true);
    try {
      const res = await fetch("/api/car-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="hcard" style={{ padding: 28, textAlign: "center" }}>
        <h2 className="exp" style={{ fontSize: 20, marginBottom: 10 }}>Request received.</h2>
        <p style={{ color: "var(--steel)" }}>
          Our sourcing team will hunt for a match in Canada and come back with a fully landed quote. You'll be notified the moment we find one.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      <Row>
        <Field label="Make"><input name="make" defaultValue={defaults?.make} placeholder="Toyota" style={inputStyle} /></Field>
        <Field label="Model"><input name="model" defaultValue={defaults?.model} placeholder="Land Cruiser" style={inputStyle} /></Field>
      </Row>
      <Row>
        <Field label="Year from"><input name="yearMin" type="number" inputMode="numeric" placeholder="2018" style={inputStyle} /></Field>
        <Field label="Year to"><input name="yearMax" type="number" inputMode="numeric" placeholder="2022" style={inputStyle} /></Field>
      </Row>
      <Row>
        <Field label="Body type">
          <select name="bodyType" style={inputStyle} defaultValue="">
            <option value="">Any</option>
            {BODY_TYPES.map((b) => <option key={b} value={b}>{b.charAt(0) + b.slice(1).toLowerCase()}</option>)}
          </select>
        </Field>
        <Field label="Max mileage (km)"><input name="maxMileageKm" type="number" inputMode="numeric" placeholder="120000" style={inputStyle} /></Field>
      </Row>

      <Field label="Budget">
        <div style={{ display: "flex", gap: 8 }}>
          <div className="seg" style={{ flex: "0 0 auto", width: 130 }}>
            {(["NGN", "CAD"] as const).map((c) => (
              <button type="button" key={c} className={currency === c ? "on" : ""} onClick={() => setCurrency(c)}>{c}</button>
            ))}
          </div>
          <input name="budgetAmount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={currency === "NGN" ? "25,000,000" : "30,000"} style={inputStyle} />
        </div>
        {converted && (
          <div className="mono" style={{ fontSize: 11, color: "var(--steel)", margin: "6px 2px 0" }}>
            {converted} <span style={{ color: "var(--steel-dim)" }}>· {currency === "NGN" ? "in CAD" : "in naira"}, live rate</span>
          </div>
        )}
      </Field>

      <Field label="Notes (optional)">
        <textarea name="notes" rows={4} placeholder="Colour, must-have features, condition preferences…" style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      {error && <div className="chip warn" style={{ alignSelf: "start" }}>{error}</div>}

      <button type="submit" className="btn btn-buy" disabled={busy} style={{ width: "100%", opacity: busy ? 0.6 : 1 }}>
        {busy ? "Sending…" : "Submit sourcing request"}
      </button>
    </form>
  );
}

const str = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};
const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : Number(s);
};

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
