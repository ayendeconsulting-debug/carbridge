"use client";

import { useEffect, useState } from "react";
import type { FxView } from "@/lib/types";

/**
 * Live FX without WebSockets (Path A). Seeds from the server-rendered snapshot,
 * then polls /api/fx/current. At 30s a buyer can't tell it from a push.
 */
export function useFxRate(initial: FxView, pollMs = 30_000): FxView {
  const [fx, setFx] = useState<FxView>(initial);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch("/api/fx/current")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setFx(d as FxView);
        })
        .catch(() => {});
    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);
  return fx;
}
