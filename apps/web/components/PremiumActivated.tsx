"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TIER_COOKIE } from "@/lib/constants";

// On a confirmed subscription, mirror the DB upgrade into the stub tier cookie
// so the gated UI reflects Premium immediately (until Clerk replaces the stub).
export function PremiumActivated() {
  useEffect(() => {
    document.cookie = `${TIER_COOKIE}=PREMIUM; path=/; max-age=${60 * 60 * 24 * 30}`;
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--stamp)", color: "#06140f", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 26, margin: "0 auto 16px" }}>✓</div>
      <h1 className="exp" style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Premium activated</h1>
      <p style={{ color: "var(--steel)", lineHeight: 1.6, marginBottom: 22 }}>
        Your subscription is active. Buy Now, Make an Offer, and Source-a-Car are unlocked, with a 72-hour rate lock on every quote.
      </p>
      <Link href="/gallery" className="btn btn-buy" style={{ display: "inline-block", textDecoration: "none" }}>
        Browse inventory
      </Link>
    </div>
  );
}
