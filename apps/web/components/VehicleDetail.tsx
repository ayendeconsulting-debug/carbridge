import Link from "next/link";
import { CarArt } from "./CarArt";
import { DetailClient } from "./DetailClient";
import { PhotoGallery } from "./PhotoGallery";
import { paletteFor, gradeColor } from "@/lib/art";
import type { FxView, Tier, VehicleDetailView } from "@/lib/types";

export function VehicleDetail({
  v,
  fx,
  tier,
  inModal = false,
}: {
  v: VehicleDetailView;
  fx: FxView;
  tier: Tier;
  inModal?: boolean;
}) {
  const pal = paletteFor(v.id);
  const hasPhotos = v.photos.length > 0;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ position: "relative" }}>
        {hasPhotos ? (
          <PhotoGallery photos={v.photos} alt={`${v.make} ${v.model}`} />
        ) : (
          <div className="ov-photo" style={{ position: "relative", background: `linear-gradient(135deg,${pal.g1},${pal.g2})`, aspectRatio: "16/10", display: "grid", placeItems: "center" }}>
            <CarArt color={pal.art} />
          </div>
        )}
        {!inModal && (
          <Link href="/gallery" className="mono" style={{ position: "absolute", left: 14, top: 14, zIndex: 2, background: "rgba(11,20,19,.7)", border: "1px solid var(--rule)", borderRadius: 8, padding: "7px 11px", fontSize: 11, color: "var(--frost)", textDecoration: "none" }}>← Inventory</Link>
        )}
      </div>

      <div style={{ padding: "18px 16px 0" }}>
        <div className="ov-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h1 className="exp" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{v.make} {v.model}</h1>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)", marginTop: 6 }}>
              {v.year} · {v.trim ?? ""} · {v.bodyType} · sourced in Canada
            </div>
          </div>
          <div className="grade" style={{ background: gradeColor(v.conditionGrade), width: 44, height: 44, fontSize: 16, position: "static" }}>{v.conditionGrade}</div>
        </div>

        {v.vin && (
          <div className="plate" style={{ marginTop: 16, border: "1px solid var(--rule)", borderRadius: 10, padding: "10px 13px", background: "rgba(255,255,255,.02)" }}>
            <div className="mono" style={{ fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--steel-dim)" }}>Vehicle Identification No.</div>
            <div className="mono" style={{ fontSize: 15, letterSpacing: 2, color: "var(--frost)", marginTop: 4 }}>{v.vin}</div>
          </div>
        )}

        <div className="statgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "16px 0" }}>
          <Stat k="Odometer" val={`${v.mileageKm.toLocaleString()} km`} />
          <Stat k="History" val={v.hasClaims ? "1 minor claim" : "Clean · no claims"} tone={v.hasClaims ? "warn" : "ok"} />
          <Stat k="Transit to Lagos" val={v.etaLabel} />
          <Stat k="Clearing" val={v.clearing ? "Quoted ✓" : "Pending"} tone={v.clearing ? "ok" : "warn"} />
        </div>

        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--steel-dim)", margin: "20px 0 8px" }}>The vehicle</div>
        <p style={{ color: "var(--steel)", lineHeight: 1.6, marginBottom: 22 }}>{v.description}</p>

        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--steel-dim)", margin: "0 0 12px" }}>Landed cost manifest</div>

        <DetailClient v={v} fx={fx} tier={tier} />
      </div>
    </div>
  );
}

function Stat({ k, val, tone }: { k: string; val: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "var(--stamp)" : tone === "warn" ? "var(--amber)" : "var(--frost)";
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 10, padding: "11px 13px", background: "rgba(255,255,255,.02)" }}>
      <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: "var(--steel-dim)" }}>{k}</div>
      <div style={{ fontWeight: 600, marginTop: 5, color, fontSize: 14 }}>{val}</div>
    </div>
  );
}
