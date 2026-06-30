"use client";

import { useEffect, useState } from "react";

/**
 * Save/watch toggle. Sits inside the gallery card's <Link>, so clicks must
 * preventDefault + stopPropagation. When `initial` is omitted (e.g. the detail
 * modal, which the server doesn't pre-fill) it syncs its state once on mount.
 */
export function FavoriteHeart({
  vehicleId,
  initial,
  size = 20,
}: {
  vehicleId: string;
  initial?: boolean;
  size?: number;
}) {
  const [on, setOn] = useState<boolean>(initial ?? false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (initial !== undefined) return;
    let alive = true;
    fetch(`/api/favorites?vehicleId=${encodeURIComponent(vehicleId)}`)
      .then((r) => r.json())
      .then((d) => alive && setOn(!!d.favorited))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [vehicleId, initial]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setHint(null);
    const next = !on;
    setOn(next); // optimistic
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId }),
      });
      if (!res.ok) {
        setOn(!next); // revert
        setHint(res.status === 401 ? "Sign in to save" : "Try again");
        return;
      }
      const d = await res.json();
      setOn(!!d.favorited);
    } catch {
      setOn(!next);
      setHint("Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Remove from saved" : "Save this vehicle"}
      title={hint ?? (on ? "Saved - watching for changes" : "Save & watch")}
      style={{
        display: "grid",
        placeItems: "center",
        width: size + 16,
        height: size + 16,
        borderRadius: 999,
        cursor: "pointer",
        border: "1px solid var(--rule)",
        background: "rgba(11,20,19,.72)",
        color: on ? "var(--amber)" : "var(--frost)",
        opacity: busy ? 0.6 : 1,
        backdropFilter: "blur(2px)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}
