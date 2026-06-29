import Link from "next/link";
import { getTier } from "@/lib/tier";
import { getMembershipPrice } from "@/lib/settings";
import { fmtNGN } from "@/lib/format";
import { UpgradeButton } from "@/components/UpgradeButton";

export const dynamic = "force-dynamic";

const BENEFITS = [
  "Reserve a vehicle at a locked landed total",
  "Make an Offer on the landed price, in ₦ or CAD",
  "72-hour FX rate lock on every quote",
  "Source-a-Car — request a specific vehicle from Canada",
  "Full accident & history report",
];

export default async function UpgradePage() {
  const tier = await getTier();
  const price = getMembershipPrice();

  if (tier === "PREMIUM") {
    return (
      <div style={{ maxWidth: 460, margin: "60px auto 0", padding: "0 20px", textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--steel-dim)" }}>Membership</div>
        <h1 className="exp" style={{ fontSize: 24, fontWeight: 800, margin: "10px 0 8px" }}>You&rsquo;re Premium</h1>
        <p style={{ color: "var(--steel)", lineHeight: 1.6, marginBottom: 22 }}>
          All buying features are unlocked. Head back to the inventory to reserve or make an offer.
        </p>
        <Link href="/gallery" className="btn btn-buy" style={{ display: "inline-block", textDecoration: "none" }}>Browse inventory</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 460, margin: "32px auto 0", padding: "0 20px 80px" }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--steel-dim)" }}>Membership</div>
      <h1 className="exp" style={{ fontSize: 26, fontWeight: 800, margin: "10px 0 6px" }}>Ayende Autos Premium</h1>
      <p style={{ color: "var(--steel)", lineHeight: 1.6, marginBottom: 20 }}>
        Browsing stays free. Premium unlocks buying — reservations and offers with a locked rate.
      </p>

      <div style={{ border: "1px solid var(--rule)", borderRadius: 14, padding: "18px 16px", background: "rgba(255,255,255,.02)", marginBottom: 18 }}>
        {price.configured ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--frost)", fontFamily: "var(--mono, monospace)" }}>{fmtNGN(price.amountNGN)}</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--steel-dim)" }}>{price.termLabel}</span>
          </div>
        ) : (
          <div className="mono" style={{ fontSize: 13, color: "var(--steel)" }}>Membership pricing coming soon.</div>
        )}

        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
          {BENEFITS.map((b) => (
            <li key={b} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "6px 0", color: "var(--frost)", fontSize: 14 }}>
              <span style={{ color: "var(--stamp)", fontWeight: 800 }}>✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {price.configured ? (
        <>
          <UpgradeButton label={`Get Premium · ${fmtNGN(price.amountNGN)}`} />
          <p className="mono" style={{ fontSize: 9, color: "var(--steel-dim)", marginTop: 12, lineHeight: 1.6 }}>
            We&rsquo;ll issue you an invoice with bank-transfer details. Premium activates once we confirm your payment.
          </p>
        </>
      ) : (
        <Link href="/gallery" className="btn" style={{ display: "inline-block", textDecoration: "none", border: "1px solid var(--rule)", color: "var(--frost)" }}>Keep browsing</Link>
      )}
    </div>
  );
}
