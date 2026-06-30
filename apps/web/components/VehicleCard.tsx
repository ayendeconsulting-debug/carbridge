"use client";

import Link from "next/link";
import { CarArt } from "./CarArt";
import { FavoriteHeart } from "./FavoriteHeart";
import { useFxRate } from "./useFxRate";
import { cardTotal } from "@/lib/format";
import { paletteFor, gradeColor } from "@/lib/art";
import type { FxView, VehicleCardView } from "@/lib/types";

export function VehicleCard({ v, fx, favorited }: { v: VehicleCardView; fx: FxView; favorited?: boolean }) {
  const live = useFxRate(fx);
  const total = cardTotal(v, live.effectiveRate);
  const pal = paletteFor(v.id);

  return (
    <Link href={`/vehicles/${v.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className="photo"
        style={{
          position: "relative",
          background: v.coverPhotoUrl
            ? "#0E211E"
            : `linear-gradient(135deg,${pal.g1},${pal.g2})`,
        }}
      >
        {v.coverPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.coverPhotoUrl}
            alt={`${v.make} ${v.model}`}
            loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <CarArt color={pal.art} />
        )}
        <span className="bl-tag">B/L · AA-{v.id.slice(0, 5).toUpperCase()}</span>
        <span className="grade" style={{ background: gradeColor(v.conditionGrade) }}>{v.conditionGrade}</span>
        <span style={{ position: "absolute", top: 10, right: 10, zIndex: 3 }}>
          <FavoriteHeart vehicleId={v.id} initial={favorited} size={18} />
        </span>
      </div>
      <div className="cbody">
        <div className="cname">{v.make} {v.model}</div>
        <div className="cyear">{v.year} · {v.trim ?? ""} · {v.bodyType}</div>
        <div className="cspecs">
          <span className="chip">{v.mileageKm.toLocaleString()} km</span>
          {v.hasClaims ? (
            <span className="chip warn">1 claim</span>
          ) : (
            <span className="chip ok">Clean</span>
          )}
          <span className="chip">{v.etaLabel}</span>
        </div>
        <div className="cland">
          <div>
            <div className="lab">Total landed · Lagos</div>
            <div className="ngn">{total.ngn}</div>
            <div className="cad">{total.cad} CAD</div>
          </div>
          <div className="incl">incl.<br />12% fee</div>
        </div>
        <div className="cbtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          View manifest
        </div>
      </div>
    </Link>
  );
}
