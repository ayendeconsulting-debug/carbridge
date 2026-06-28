"use client";

import { useState } from "react";
import type { PhotoView } from "@/lib/types";

export function PhotoGallery({ photos, alt }: { photos: PhotoView[]; alt: string }) {
  const [i, setI] = useState(0);
  const main = photos[i] ?? photos[0];
  if (!main) return null;

  return (
    <div>
      <div
        className="ov-photo"
        style={{
          position: "relative",
          background: "#0E211E",
          aspectRatio: "16/10",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={main.url}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>

      {photos.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "10px 0 2px",
          }}
        >
          {photos.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Photo ${idx + 1}`}
              style={{
                flex: "0 0 auto",
                padding: 0,
                borderRadius: 8,
                overflow: "hidden",
                cursor: "pointer",
                background: "transparent",
                border:
                  idx === i ? "2px solid var(--amber)" : "1px solid var(--rule)",
                lineHeight: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                style={{ width: 66, height: 46, objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
