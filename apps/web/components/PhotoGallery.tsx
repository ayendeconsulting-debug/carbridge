"use client";

import { useState, useRef } from "react";
import type { PhotoView } from "@/lib/types";

/**
 * Full-image carousel for the vehicle detail view. Each photo renders at its
 * own natural aspect (no crop, no forced frame); the stage hugs the current
 * image up to a height cap. Navigate by swipe, arrows, or dots.
 */
export function PhotoGallery({ photos, alt }: { photos: PhotoView[]; alt: string }) {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const n = photos.length;
  if (n === 0) return null;

  const go = (d: number) => setI((p) => (p + d + n) % n);
  const cur = photos[Math.min(i, n - 1)]!;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? startX.current) - startX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    startX.current = null;
  };

  return (
    <div style={{ background: "#0B1413" }}>
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: "relative",
          textAlign: "center",
          background: "#0B1413",
          minHeight: 200,
          maxHeight: "72vh",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={cur.id}
          src={cur.url}
          alt={`${alt} - photo ${i + 1} of ${n}`}
          style={{
            display: "block",
            margin: "0 auto",
            maxWidth: "100%",
            maxHeight: "72vh",
            width: "auto",
            height: "auto",
          }}
        />

        {n > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go(-1)} style={arrowStyle("left")}>‹</button>
            <button type="button" aria-label="Next photo" onClick={() => go(1)} style={arrowStyle("right")}>›</button>
            <span className="mono" style={counterStyle}>{i + 1} / {n}</span>
          </>
        )}
      </div>

      {n > 1 && (
        <div style={{ display: "flex", gap: 7, justifyContent: "center", padding: "11px 0 3px", flexWrap: "wrap" }}>
          {photos.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Go to photo ${idx + 1}`}
              aria-current={idx === i}
              onClick={() => setI(idx)}
              style={{
                width: 8,
                height: 8,
                padding: 0,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                background: idx === i ? "var(--amber)" : "rgba(255,255,255,.25)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    left: side === "left" ? 8 : undefined,
    right: side === "right" ? 8 : undefined,
    transform: "translateY(-50%)",
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(11,20,19,.62)",
    border: "1px solid var(--rule)",
    color: "var(--frost)",
    fontSize: 22,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    zIndex: 2,
  };
}

const counterStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  background: "rgba(11,20,19,.62)",
  border: "1px solid var(--rule)",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 11,
  color: "var(--frost)",
  zIndex: 2,
};
