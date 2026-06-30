import Link from "next/link";
import { SourceACarForm } from "@/components/SourceACarForm";
import { getTier } from "@/lib/tier";
import { getCurrentSnapshot } from "@/lib/fx";

export const dynamic = "force-dynamic";

export default async function SourceACarPage({
  searchParams,
}: {
  searchParams: Promise<{ make?: string | string[]; model?: string | string[] }>;
}) {
  const [tier, fx, sp] = await Promise.all([getTier(), getCurrentSnapshot(), searchParams]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const defaults = { make: one(sp.make), model: one(sp.model) };

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
        <SourceACarForm fx={fx} defaults={defaults} />
      ) : (
        <div className="hcard" style={{ padding: 26, textAlign: "center" }}>
          <h3 className="exp" style={{ fontSize: 18, marginBottom: 8 }}>Premium unlocks sourcing</h3>
          <p style={{ color: "var(--steel)", marginBottom: 16 }}>
            Special requests are a Premium feature - our team personally hunts the Canadian market for your exact spec and budget, then comes back with a fully landed quote.
          </p>
          <Link href="/upgrade" className="btn btn-buy" style={{ display: "inline-block", marginBottom: 14 }}>Go Premium</Link>
          <div>
            <Link href="/gallery" className="mono" style={{ color: "var(--amber)", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
              ← Back to inventory
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
