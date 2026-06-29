"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Self-serve Premium: requests a membership invoice for the signed-in buyer,
// then sends them to "My activity" to view bank details and pay. No checkout,
// no self-activation — an admin grants Premium once payment is confirmed.
export function UpgradeButton({ label = "Get Premium" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/memberships/request", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyPremium?: boolean;
        invoiceId?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not start your membership request.");
        return;
      }
      if (data.alreadyPremium) {
        router.refresh();
        return;
      }
      // Invoice issued (or an open one reused) — go pay it in My activity.
      router.push("/account");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="btn btn-buy" style={{ width: "100%" }} onClick={start} disabled={busy}>
        {busy ? "Setting up…" : label}
      </button>
      {error && <p style={{ color: "var(--amber)", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
