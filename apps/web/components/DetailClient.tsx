"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFxRate } from "./useFxRate";
import { detailLedger, fmtNGN, fmtCAD, rateLabel } from "@/lib/format";
import { TIER_COOKIE } from "@/lib/constants";
import type { ShippingMethod } from "@carbridge/shared";
import type {
  Currency,
  FxView,
  OfferResult,
  ReservationResult,
  Tier,
  VehicleDetailView,
} from "@/lib/types";

const METHOD_LABEL: Record<ShippingMethod, string> = {
  RORO: "RoRo",
  CONTAINER: "Container",
};

type SheetKind = "offer" | "buy" | null;

/** Strip symbol/commas from a formatted money string -> plain numeric string. */
function rawAmount(formatted: string): string {
  return formatted.replace(/[^0-9.]/g, "");
}

function expiryLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DetailClient({
  v,
  fx,
  tier,
}: {
  v: VehicleDetailView;
  fx: FxView;
  tier: Tier;
}) {
  const live = useFxRate(fx);
  const router = useRouter();
  const methods = useMemo(
    () => Array.from(new Set(v.shippingOptions.map((o) => o.method))) as ShippingMethod[],
    [v.shippingOptions],
  );
  const [method, setMethod] = useState<ShippingMethod>(v.defaultShippingMethod);
  const [gate, setGate] = useState(false);

  // offer / reservation flow state
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [amountCurrency, setAmountCurrency] = useState<Currency>("NGN");
  const [offerResult, setOfferResult] = useState<OfferResult | null>(null);
  const [reserveResult, setReserveResult] = useState<ReservationResult | null>(null);
  const [reserved, setReserved] = useState(false);

  const ledger = detailLedger(v, method, live.effectiveRate);
  const line = (key: string) => ledger.lines.find((l) => l.key === key);
  const isPremium = tier === "PREMIUM";

  const goPremium = () => {
    document.cookie = `${TIER_COOKIE}=PREMIUM; path=/; max-age=${60 * 60 * 24 * 30}`;
    setGate(false);
    router.refresh();
  };

  const closeSheet = () => {
    if (submitting) return;
    setSheet(null);
    setError(null);
    setOfferResult(null);
    setReserveResult(null);
  };

  const openOffer = () => {
    if (!isPremium) return setGate(true);
    setError(null);
    setOfferResult(null);
    setAmountCurrency("NGN");
    setAmount(rawAmount(ledger.total.ngn));
    setSheet("offer");
  };

  const openBuy = () => {
    if (!isPremium) return setGate(true);
    setError(null);
    setReserveResult(null);
    setSheet("buy");
  };

  const onCurrencyToggle = (c: Currency) => {
    setAmountCurrency(c);
    setAmount(rawAmount(c === "NGN" ? ledger.total.ngn : ledger.total.cad));
  };

  const submitOffer = async () => {
    if (!(Number(amount) > 0)) {
      setError("Enter an offer amount greater than zero.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: v.id,
          method,
          amount,
          currency: amountCurrency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit your offer.");
        return;
      }
      setOfferResult(data as OfferResult);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReserve = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: v.id, method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not complete the reservation.");
        return;
      }
      setReserveResult(data as ReservationResult);
      setReserved(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {methods.length > 1 && (
        <div className="seg" style={{ margin: "0 0 16px" }}>
          {methods.map((m) => {
            const opt = v.shippingOptions.find((o) => o.method === m);
            return (
              <button key={m} className={method === m ? "on" : ""} onClick={() => setMethod(m)}>
                {METHOD_LABEL[m]}
                {opt ? ` · ${opt.transitWeeksMin}–${opt.transitWeeksMax} wk` : ""}
              </button>
            );
          })}
        </div>
      )}

      <div className="ledger">
        <div className="seclabel origin">Origin · Canada<span className="ln" /></div>
        <div className="lline origin">
          <div className="name">Purchase price<div className="meta">{v.year} {v.make} {v.model}</div></div>
          <div className="lvals"><div className="primary">{line("purchase")?.cad}</div><div className="secondary">{line("purchase")?.ngn}</div></div>
        </div>
        <div className="lline origin">
          <div className="name">Ocean shipping<div className="meta">{METHOD_LABEL[method]} · Halifax → Lagos</div></div>
          <div className="lvals"><div className="primary">{line("shipping")?.cad}</div><div className="secondary">{line("shipping")?.ngn}</div></div>
        </div>
        <div className="crossing"><span className="track" /><span className="lbl">🚢 Crosses to Lagos</span><span className="track" /></div>
        <div className="seclabel dest">Destination · Lagos<span className="ln" /></div>
        <div className="lline dest">
          <div className="name">Clearing &amp; duty<div className="meta">{v.clearing?.agentName ?? "Manual agent quotation"}</div></div>
          <div className="lvals"><div className="primary">{line("clearing")?.ngn}</div><div className="secondary">{line("clearing")?.cad}</div></div>
        </div>
        <div className="lline dest">
          <div className="name">CarBridge handling<div className="meta">12% of landed subtotal</div></div>
          <div className="lvals"><div className="primary">{line("handling")?.ngn}</div><div className="secondary">{line("handling")?.cad}</div></div>
        </div>
        <div className="totalblk">
          <div className="stamp"><div className="big">CLEARED</div><div className="small">PORT OF LAGOS · 2026</div></div>
          <div className="tk">Total landed cost<span className="ln" /></div>
          <div className="odo">{line("total")?.ngn}</div>
          <div className="cad-line"><span className="pill">≈ CAD</span><span className="cadval">{line("total")?.cad}</span><span className="note">delivered &amp; cleared</span></div>
        </div>
      </div>

      <p className="mono" style={{ fontSize: 9, letterSpacing: 0.3, color: "var(--steel-dim)", margin: "12px 2px 96px", lineHeight: 1.6 }}>
        Clearing is a manual quotation from an accredited Lagos agent. FX is indicative ({live.isStale ? "rate may be delayed" : "live"}) until rate-locked at offer or reservation.
      </p>

      <div className="actionbar">
        <div className="act-price">
          <div className="k">{reserved ? "Reserved · locked" : "Total landed"}</div>
          <div className="v">{reserved && reserveResult ? fmtNGN(reserveResult.lockedTotal.ngn) : line("total")?.ngn}</div>
        </div>
        {reserved ? (
          <div className="btn" style={{ background: "var(--stamp)", color: "#06140f", fontWeight: 700, pointerEvents: "none" }}>
            ✓ Reserved
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-offer" onClick={openOffer}>
              {!isPremium && <LockIcon />}Make offer
            </button>
            <button className="btn btn-buy" onClick={openBuy}>
              {!isPremium && <LockIcon />}Buy now
            </button>
          </div>
        )}
      </div>

      {gate && (
        <div className="scrim show" onClick={() => setGate(false)}>
          <div className="sheet show" onClick={(e) => e.stopPropagation()}>
            <h3 className="exp" style={{ fontSize: 18, marginBottom: 8 }}>Premium unlocks buying</h3>
            <p style={{ color: "var(--steel)", marginBottom: 18 }}>
              Buy Now and Make an Offer — with a 72-hour rate lock — are Premium features. Browsing stays free.
            </p>
            <button className="btn btn-buy" style={{ width: "100%" }} onClick={goPremium}>
              Switch to Premium (demo)
            </button>
          </div>
        </div>
      )}

      {sheet === "offer" && (
        <div className="scrim show" onClick={closeSheet}>
          <div className="sheet show" onClick={(e) => e.stopPropagation()}>
            {offerResult ? (
              <ResultPanel
                title="Offer submitted"
                rows={[
                  { k: "Your offer", v: offerResult.currency === "NGN" ? fmtNGN(offerResult.amount) : fmtCAD(offerResult.amount) },
                  { k: "Listed total", v: `${fmtNGN(offerResult.listedTotal.ngn)} · ${fmtCAD(offerResult.listedTotal.cad)}` },
                  { k: "Locked rate", v: rateLabel(offerResult.rateLock.rate) },
                  { k: "Lock expires", v: `${expiryLabel(offerResult.rateLock.expiresAt)} · 72h` },
                  { k: "Status", v: offerResult.status },
                ]}
                note="Our team will review your offer and respond. The FX rate and landed figures above are locked for 72 hours."
                onDone={closeSheet}
              />
            ) : (
              <>
                <h3 className="exp" style={{ fontSize: 18, marginBottom: 4 }}>Make an offer</h3>
                <p className="mono" style={{ fontSize: 10, color: "var(--steel-dim)", marginBottom: 16 }}>
                  {v.year} {v.make} {v.model} · {METHOD_LABEL[method]} · listed {fmtNGN(ledger.total.ngn)}
                </p>

                <div className="seg" style={{ marginBottom: 12 }}>
                  {(["NGN", "CAD"] as Currency[]).map((c) => (
                    <button key={c} className={amountCurrency === c ? "on" : ""} onClick={() => onCurrencyToggle(c)}>
                      {c === "NGN" ? "₦ Naira" : "$ CAD"}
                    </button>
                  ))}
                </div>

                <label className="mono" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)" }}>
                  Your offer on the landed total
                </label>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  style={{
                    width: "100%", marginTop: 6, padding: "12px 14px",
                    background: "rgba(255,255,255,.03)", border: "1px solid var(--rule)",
                    borderRadius: 10, color: "var(--frost)", fontSize: 18,
                    fontFamily: "var(--mono, monospace)",
                  }}
                />

                {error && <p style={{ color: "var(--amber)", fontSize: 13, marginTop: 12 }}>{error}</p>}

                <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                  <button className="btn" onClick={closeSheet} disabled={submitting} style={{ flex: 1, background: "transparent", border: "1px solid var(--rule)", color: "var(--steel)" }}>
                    Cancel
                  </button>
                  <button className="btn btn-buy" onClick={submitOffer} disabled={submitting} style={{ flex: 2 }}>
                    {submitting ? "Submitting…" : "Submit offer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {sheet === "buy" && (
        <div className="scrim show" onClick={closeSheet}>
          <div className="sheet show" onClick={(e) => e.stopPropagation()}>
            {reserveResult ? (
              <ResultPanel
                title="Vehicle reserved"
                rows={[
                  { k: "Locked total", v: `${fmtNGN(reserveResult.lockedTotal.ngn)}` },
                  { k: "≈ CAD", v: fmtCAD(reserveResult.lockedTotal.cad) },
                  { k: "Locked rate", v: rateLabel(reserveResult.rateLock.rate) },
                  { k: "Reservation holds", v: `until ${expiryLabel(reserveResult.expiresAt)} · 72h` },
                  { k: "Status", v: reserveResult.status },
                ]}
                note="Our team will reach out to finalize settlement off-platform. The total and FX rate are frozen for 72 hours."
                onDone={closeSheet}
              />
            ) : (
              <>
                <h3 className="exp" style={{ fontSize: 18, marginBottom: 4 }}>Reserve this vehicle</h3>
                <p className="mono" style={{ fontSize: 10, color: "var(--steel-dim)", marginBottom: 16 }}>
                  {v.year} {v.make} {v.model} · {METHOD_LABEL[method]}
                </p>

                <div style={{ border: "1px solid var(--rule)", borderRadius: 12, padding: "16px 14px", background: "rgba(255,255,255,.02)", marginBottom: 16 }}>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)" }}>Total landed — locks for 72h</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "var(--frost)", margin: "6px 0 2px", fontFamily: "var(--mono, monospace)" }}>{fmtNGN(ledger.total.ngn)}</div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--steel)" }}>≈ {fmtCAD(ledger.total.cad)} · {rateLabel(live.effectiveRate)}</div>
                </div>

                <p style={{ color: "var(--steel)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  Reserving freezes this total and the FX rate for 72 hours and takes the vehicle off the market. Settlement is finalized off-platform with our team — no payment is taken here.
                </p>

                {error && <p style={{ color: "var(--amber)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={closeSheet} disabled={submitting} style={{ flex: 1, background: "transparent", border: "1px solid var(--rule)", color: "var(--steel)" }}>
                    Cancel
                  </button>
                  <button className="btn btn-buy" onClick={submitReserve} disabled={submitting} style={{ flex: 2 }}>
                    {submitting ? "Reserving…" : "Confirm reservation"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ResultPanel({
  title,
  rows,
  note,
  onDone,
}: {
  title: string;
  rows: { k: string; v: string }[];
  note: string;
  onDone: () => void;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--stamp)", color: "#06140f", display: "grid", placeItems: "center", fontWeight: 800 }}>✓</div>
        <h3 className="exp" style={{ fontSize: 18 }}>{title}</h3>
      </div>
      <div style={{ border: "1px solid var(--rule)", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        {rows.map((r, i) => (
          <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 13px", borderTop: i ? "1px solid var(--rule)" : "none", background: "rgba(255,255,255,.02)" }}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--steel-dim)" }}>{r.k}</span>
            <span className="mono" style={{ fontSize: 13, color: "var(--frost)", textAlign: "right" }}>{r.v}</span>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--steel)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{note}</p>
      <button className="btn btn-buy" style={{ width: "100%" }} onClick={onDone}>Done</button>
    </>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}
