"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fmtNGN, fmtCAD } from "@/lib/format";
import type {
  MyOfferView,
  MyReservationView,
  MyReservationBilling,
  MyMembershipInvoiceView,
  MySubscriptionView,
  MyCarRequestView,
  CarWishlist,
  Currency,
} from "@/lib/types";

function wishlistLabel(w: CarWishlist): string {
  const years = w.yearMin || w.yearMax ? `${w.yearMin ?? "?"}–${w.yearMax ?? "?"}` : "";
  const makeModel = [w.make, w.model].filter(Boolean).join(" ");
  const km = w.maxMileageKm ? `≤${w.maxMileageKm.toLocaleString()} km` : "";
  return [years, makeModel || "Any vehicle", w.bodyType, km].filter(Boolean).join(" · ");
}

const fmt = (amount: string, currency: Currency) =>
  currency === "NGN" ? fmtNGN(amount) : fmtCAD(amount);

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: "var(--amber)", COUNTERED: "var(--amber)", PENDING: "var(--amber)", ACTIVE: "var(--stamp)",
  ACCEPTED: "var(--stamp)", CONFIRMED: "var(--stamp)",
  ISSUED: "var(--frost)", PART_PAID: "var(--amber)", PAID: "var(--stamp)", DRAFT: "var(--steel-dim)", VOID: "var(--steel-dim)",
  DECLINED: "var(--steel-dim)", CANCELLED: "var(--steel-dim)", EXPIRED: "var(--steel-dim)", PAST_DUE: "var(--amber)",
};

function Badge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "var(--frost)";
  return (
    <span className="mono" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: tone, border: `1px solid ${tone}`, borderRadius: 6, padding: "2px 7px" }}>{status}</span>
  );
}

function Field({ k, children, tone }: { k: string; children: React.ReactNode; tone?: "dim" }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)" }}>{k}</div>
      <div className="mono" style={{ fontSize: 14, color: tone === "dim" ? "var(--steel-dim)" : "var(--frost)", marginTop: 3 }}>{children}</div>
    </div>
  );
}

export function MyActivity({
  tier,
  subscription,
  membershipInvoice,
  reservations,
  offers,
  carRequests,
}: {
  tier: string;
  subscription: MySubscriptionView | null;
  membershipInvoice: MyMembershipInvoiceView | null;
  reservations: MyReservationView[];
  offers: MyOfferView[];
  carRequests: MyCarRequestView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);

  const respond = async (id: string, action: "accept" | "decline") => {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/offers/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ id, text: data.error ?? "Action failed" });
        return;
      }
      router.refresh();
    } catch {
      setMsg({ id, text: "Network error — try again" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 80px" }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--steel-dim)" }}>Your account</div>
      <h1 className="exp" style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>My activity</h1>

      {/* Subscription */}
      <SectionLabel>Membership</SectionLabel>
      <div style={cardStyle}>
        {subscription ? (
          <div style={rowTop}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--frost)" }}>{subscription.plan}</div>
              <div className="mono" style={metaStyle}>since {shortDate(subscription.startedAt)} · renews {shortDate(subscription.expiresAt)}</div>
            </div>
            <Badge status={subscription.status} />
          </div>
        ) : tier === "PREMIUM" ? (
          <div style={rowTop}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--frost)" }}>Premium</div>
              <div className="mono" style={metaStyle}>demo access · no payment on file</div>
            </div>
            <Badge status="ACTIVE" />
          </div>
        ) : (
          <div style={{ ...rowTop, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--frost)" }}>Free · Registered</div>
              <div className="mono" style={metaStyle}>upgrade to unlock buying</div>
            </div>
            <Link href="/upgrade" className="btn btn-buy" style={{ textDecoration: "none" }}>Go Premium</Link>
          </div>
        )}
      </div>

      {membershipInvoice && membershipInvoice.status !== "PAID" && (
        <MembershipInvoiceBlock inv={membershipInvoice} />
      )}

      {/* Reservations */}
      <SectionLabel>Reservations · {reservations.length}</SectionLabel>
      {reservations.length === 0 && <Empty>You haven&rsquo;t reserved a vehicle yet.</Empty>}
      {reservations.map((r) => (
        <div key={r.id} style={cardStyle}>
          <div style={rowTop}>
            <div>
              <Link href={`/vehicles/${r.vehicle.id}`} style={{ fontWeight: 700, color: "var(--frost)", textDecoration: "none" }}>{r.vehicle.name}</Link>
              <div className="mono" style={metaStyle}>{r.shippingMethod} · reserved {shortDate(r.createdAt)}</div>
            </div>
            <Badge status={r.status} />
          </div>
          <div style={fieldRow}>
            <Field k="Locked total">{fmtNGN(r.lockedTotalNGN)}</Field>
            <Field k="≈ CAD">{fmtCAD(r.lockedTotalCAD)}</Field>
            <Field k="Holds" tone={r.expired ? "dim" : undefined}>
              {r.expiresAt ? (r.expired ? "expired" : `until ${shortDate(r.expiresAt)}`) : "—"}
            </Field>
          </div>
          {r.billing && <BillingBlock b={r.billing} />}
        </div>
      ))}

      {/* Offers */}
      <SectionLabel>Offers · {offers.length}</SectionLabel>
      {offers.length === 0 && <Empty>You haven&rsquo;t made any offers yet.</Empty>}
      {offers.map((o) => {
        const isBusy = busy === o.id;
        return (
          <div key={o.id} style={cardStyle}>
            <div style={rowTop}>
              <div>
                <Link href={`/vehicles/${o.vehicle.id}`} style={{ fontWeight: 700, color: "var(--frost)", textDecoration: "none" }}>{o.vehicle.name}</Link>
                <div className="mono" style={metaStyle}>{o.shippingMethod} · offered {shortDate(o.createdAt)}</div>
              </div>
              <Badge status={o.status} />
            </div>
            <div style={fieldRow}>
              <Field k="Your offer">{fmt(o.amount, o.currency)}</Field>
              {o.listedTotal && <Field k="Listed">{fmtNGN(o.listedTotal.ngn)}</Field>}
              {o.counter && <Field k="Counter">{fmt(o.counter.amount, o.counter.currency)}</Field>}
              <Field k="Rate lock" tone={o.rateExpired ? "dim" : undefined}>
                {o.rateExpiresAt ? (o.rateExpired ? "expired" : `holds ${shortDate(o.rateExpiresAt)}`) : "—"}
              </Field>
            </div>

            {msg?.id === o.id && <p style={errStyle}>{msg.text}</p>}

            {o.canRespond && (
              <div style={{ marginTop: 12 }}>
                <p className="mono" style={{ fontSize: 11, color: "var(--amber)", marginBottom: 8 }}>
                  Countered at {o.counter ? fmt(o.counter.amount, o.counter.currency) : "—"} — your move:
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-buy" disabled={isBusy} onClick={() => respond(o.id, "accept")}>{isBusy ? "…" : "Accept counter"}</button>
                  <button className="btn" disabled={isBusy} onClick={() => respond(o.id, "decline")} style={dangerBtn}>Decline</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <SectionLabel>Source-a-Car requests · {carRequests.length}</SectionLabel>
      {carRequests.length === 0 && <Empty>You haven&rsquo;t requested a vehicle yet.</Empty>}
      {carRequests.map((cr) => (
        <div key={cr.id} style={cardStyle}>
          <div style={rowTop}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--frost)" }}>{wishlistLabel(cr.wishlist)}</div>
              <div className="mono" style={metaStyle}>requested {shortDate(cr.createdAt)}</div>
            </div>
            <Badge status={cr.status} />
          </div>
          <div style={fieldRow}>
            <Field k="Budget">{cr.budget.currency === "NGN" ? fmtNGN(cr.budget.amount) : fmtCAD(cr.budget.amount)}</Field>
          </div>
          {cr.matched && (
            <p className="mono" style={{ fontSize: 12, color: "var(--stamp)", marginTop: 8 }}>
              Matched →{" "}
              <Link href={`/vehicles/${cr.matched.id}`} style={{ color: "var(--stamp)", textDecoration: "underline" }}>{cr.matched.name}</Link>
            </p>
          )}
          {cr.adminNote && <p style={{ color: "var(--steel)", fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>{cr.adminNote}</p>}
        </div>
      ))}
    </div>
  );
}

function MembershipInvoiceBlock({ inv }: { inv: MyMembershipInvoiceView }) {
  const remaining = Math.max(0, Number(inv.amountNGN) - Number(inv.amountPaidNGN)).toFixed(2);
  return (
    <div style={cardStyle}>
      <div style={rowTop}>
        <div>
          <div style={{ fontWeight: 700, color: "var(--frost)" }}>Premium membership invoice</div>
          <div className="mono" style={metaStyle}>
            {inv.number ?? inv.id.slice(0, 8)}{inv.dueAt ? ` · due ${shortDate(inv.dueAt)}` : ""}
          </div>
        </div>
        <Badge status={inv.status} />
      </div>
      <div style={fieldRow}>
        <Field k="Amount">{fmtNGN(inv.amountNGN)}</Field>
        <Field k="Paid">{fmtNGN(inv.amountPaidNGN)}</Field>
        <Field k="Remaining">{fmtNGN(remaining)}</Field>
      </div>
      {inv.bank ? (
        <div style={{ border: "1px solid var(--rule)", borderRadius: 10, padding: 12, marginTop: 8, background: "rgba(255,255,255,.015)" }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)", marginBottom: 8 }}>Pay into</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Field k="Bank">{inv.bank.bankName}</Field>
            <Field k="Account name">{inv.bank.accountName}</Field>
            <Field k="Account number">{inv.bank.accountNumber}</Field>
          </div>
          {inv.bank.referenceHint && (
            <p className="mono" style={{ fontSize: 11, color: "var(--amber)", marginTop: 10 }}>
              Quote reference {inv.bank.referenceHint} on your transfer.
            </p>
          )}
          <p style={{ fontSize: 12, color: "var(--steel)", marginTop: 10, lineHeight: 1.6 }}>
            Transfer {fmtNGN(remaining)} to the account above. Your Premium activates as soon as we confirm the payment.
          </p>
        </div>
      ) : (
        <p className="mono" style={{ fontSize: 11, color: "var(--steel-dim)", marginTop: 8 }}>Payment details will be shared shortly.</p>
      )}
    </div>
  );
}

function BillingBlock({ b }: { b: MyReservationBilling }) {
  const inv = b.invoice;
  const remaining = inv ? Math.max(0, Number(inv.amountNGN) - Number(inv.amountPaidNGN)).toFixed(2) : "0";
  return (
    <div style={{ borderTop: "1px solid var(--rule)", marginTop: 12, paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)" }}>Billing</span>
        {b.quoteNumber && <span className="mono" style={{ fontSize: 11, color: "var(--steel)" }}>Quote {b.quoteNumber}</span>}
        {b.quoteStatus && <Badge status={b.quoteStatus} />}
      </div>

      {!inv && (
        <p className="mono" style={{ fontSize: 11, color: "var(--steel-dim)", marginTop: 8 }}>
          Quotation issued — your invoice with payment details will appear here shortly.
        </p>
      )}

      {inv && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {inv.number && <span className="mono" style={{ fontSize: 12, color: "var(--frost)" }}>Invoice {inv.number}</span>}
            <Badge status={inv.status} />
            {inv.dueAt && inv.status !== "PAID" && <span className="mono" style={{ fontSize: 10, color: "var(--steel-dim)" }}>due {shortDate(inv.dueAt)}</span>}
          </div>

          <div style={fieldRow}>
            <Field k="Amount">{fmtNGN(inv.amountNGN)}</Field>
            <Field k="Paid">{fmtNGN(inv.amountPaidNGN)}</Field>
            {inv.status !== "PAID" && <Field k="Remaining">{fmtNGN(remaining)}</Field>}
          </div>

          {inv.status === "PAID" ? (
            <p className="mono" style={{ fontSize: 12, color: "var(--stamp)", marginTop: 8 }}>✓ Payment received in full — your vehicle is confirmed.</p>
          ) : inv.bank ? (
            <div style={{ border: "1px solid var(--rule)", borderRadius: 10, padding: 12, marginTop: 10, background: "rgba(255,255,255,.015)" }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)", marginBottom: 8 }}>Pay into</div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <Field k="Bank">{inv.bank.bankName}</Field>
                <Field k="Account name">{inv.bank.accountName}</Field>
                <Field k="Account number">{inv.bank.accountNumber}</Field>
              </div>
              {inv.bank.referenceHint && (
                <p className="mono" style={{ fontSize: 11, color: "var(--amber)", marginTop: 10 }}>
                  Quote reference {inv.bank.referenceHint} on your transfer.
                </p>
              )}
              {inv.bank.note && <p className="mono" style={{ fontSize: 10, color: "var(--steel-dim)", marginTop: 6 }}>{inv.bank.note}</p>}
              <p style={{ fontSize: 12, color: "var(--steel)", marginTop: 10, lineHeight: 1.6 }}>
                Transfer {fmtNGN(remaining)} to the account above. We confirm your reservation as soon as the payment lands.
              </p>
            </div>
          ) : (
            <p className="mono" style={{ fontSize: 11, color: "var(--steel-dim)", marginTop: 8 }}>Payment details will be shared shortly.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--steel-dim)", margin: "26px 2px 12px" }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--steel-dim)", fontSize: 13, padding: "4px 2px" }}>{children}</p>;
}

const cardStyle: React.CSSProperties = { border: "1px solid var(--rule)", borderRadius: 12, padding: "14px 15px", background: "rgba(255,255,255,.02)", marginBottom: 10 };
const rowTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 };
const fieldRow: React.CSSProperties = { display: "flex", gap: 18, flexWrap: "wrap", margin: "10px 0 2px" };
const metaStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 0.3, color: "var(--steel-dim)", marginTop: 4 };
const errStyle: React.CSSProperties = { color: "var(--amber)", fontSize: 12, marginTop: 10 };
const dangerBtn: React.CSSProperties = { background: "transparent", border: "1px solid var(--amber)", color: "var(--amber)" };
