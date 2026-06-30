import Link from "next/link";
import { SourceACarForm } from "@/components/SourceACarForm";
import { getTier } from "@/lib/tier";

export const dynamic = "force-dynamic";

export default async function SourceACarPage() {
  const tier = await getTier();

  return (
    <div className="gwrap">
      <div className="ghead" style={{ display: "block", marginBottom: 6 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--amber-deep)" }}>Premium · concierge</div>
        <h2 className="exp" style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>Source a car</h2>
      </div>
      <p style={{ color: "var(--steel)", margin: "0 4px 22px", maxWidth: 520 }}>
        Can't find it in inventory? Tell us what you're after and your budget, and our team will hunt for a match in Canada - then come back with a fully landed quote.
      </p>

      {tier === "PREMIUM" ? (
        <SourceACarForm />
      ) : (
        <div className="hcard" style={{ padding: 26, textAlign: "center" }}>
          <h3 className="exp" style={{ fontSize: 18, marginBottom: 8 }}>Premium unlocks sourcing</h3>
          <p style={{ color: "var(--steel)", marginBottom: 16 }}>
            Special requests are a Premium feature. Switch to Premium with the “View as” control in the header to try it.
          </p>
          <Link href="/gallery" className="mono" style={{ color: "var(--amber)", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
            ← Back to inventory
          </Link>
        </div>
      )}
    </div>
  );
}
