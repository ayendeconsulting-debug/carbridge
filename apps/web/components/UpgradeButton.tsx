"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIER_COOKIE } from "@/lib/constants";
import type { CheckoutResult } from "@/lib/types";

export function UpgradeButton({ label = "Go Premium" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/checkout", { method: "POST" });
      const data = (await res.json()) as CheckoutResult;
      if (!res.ok) {
        setError(data.error ?? "Could not start checkout.");
        return;
      }
      if (data.alreadyPremium) {
        document.cookie = `${TIER_COOKIE}=PREMIUM; path=/; max-age=${60 * 60 * 24 * 30}`;
        router.refresh();
        return;
      }
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      setError("Unexpected response from checkout.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="btn btn-buy" style={{ width: "100%" }} onClick={start} disabled={busy}>
        {busy ? "Starting checkout…" : label}
      </button>
      {error && <p style={{ color: "var(--amber)", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
