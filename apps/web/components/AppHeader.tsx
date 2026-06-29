"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useFxRate } from "./useFxRate";
import { rateLabel, agoLabel } from "@/lib/format";
import { TIER_COOKIE } from "@/lib/constants";
import { CLERK_ENABLED } from "@/lib/clerk-flag";
import type { FxView, Tier } from "@/lib/types";

const TIERS: { key: Tier; label: string }[] = [
  { key: "GUEST", label: "Guest" },
  { key: "REGISTERED", label: "Registered" },
  { key: "PREMIUM", label: "Premium" },
];

export function AppHeader({ fx, tier, isAdmin = false }: { fx: FxView; tier: Tier; isAdmin?: boolean }) {
  const live = useFxRate(fx);
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navOn = (href: string) =>
    href === "/gallery"
      ? pathname.startsWith("/gallery") || pathname.startsWith("/vehicles")
      : pathname.startsWith(href);

  const setTier = (t: Tier) => {
    document.cookie = `${TIER_COOKIE}=${t}; path=/; max-age=${60 * 60 * 24 * 30}`;
    router.refresh();
  };

  const chipClass =
    tier === "PREMIUM"
      ? "tier-premium"
      : tier === "REGISTERED"
        ? "tier-registered"
        : "tier-guest";

  return (
    <header>
      <div className="htop">
        <Link href="/" className="brand" style={{ textDecoration: "none" }}>
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 13l2-5a3 3 0 012.8-2h8.4A3 3 0 0119 8l2 5v5a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1H7v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z" fill="#0B1413" />
              <circle cx="7.5" cy="14.5" r="1.4" fill="#E8973A" />
              <circle cx="16.5" cy="14.5" r="1.4" fill="#E8973A" />
            </svg>
          </div>
          <div className="wm">Ayende Autos<small>CANADA → LAGOS</small></div>
        </Link>
        <div className="acct">
          {tier !== "PREMIUM" && (
            <Link
              href="/upgrade"
              className="mono"
              style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: 7, padding: "5px 9px", textDecoration: "none" }}
            >
              Go Premium
            </Link>
          )}
          <span className={`tier-chip ${chipClass}`}>{tier.charAt(0) + tier.slice(1).toLowerCase()}</span>
          {CLERK_ENABLED ? (
            <>
              <Show when="signed-in">
                <Link href="/account" className="acct-activity mono" style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--steel)", textDecoration: "none" }}>Activity</Link>
                <UserButton />
              </Show>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="mono" style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--frost)", background: "transparent", border: "1px solid var(--rule)", borderRadius: 7, padding: "5px 9px", cursor: "pointer" }}>Sign in</button>
                </SignInButton>
              </Show>
            </>
          ) : (
            <Link href="/account" className="avatar" style={{ textDecoration: "none", display: "grid", placeItems: "center" }}>CB</Link>
          )}
          <button
            className="burger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="hmenu" onClick={() => setMenuOpen(false)}>
          <Link href="/gallery" className={navOn("/gallery") ? "on" : ""}>Gallery</Link>
          <Link href="/account" className={navOn("/account") ? "on" : ""}>Activity</Link>
          {isAdmin && <Link href="/admin" className={navOn("/admin") ? "on" : ""}>Admin</Link>}
        </nav>
      )}

      <nav className="hnav">
        <Link href="/gallery" className={`navlink${navOn("/gallery") ? " on" : ""}`}>Gallery</Link>
        <Link href="/account" className={`navlink${navOn("/account") ? " on" : ""}`}>Activity</Link>
        {isAdmin && (
          <Link href="/admin" className={`navlink admin${navOn("/admin") ? " on" : ""}`}>Admin</Link>
        )}
      </nav>

      <div className="fx">
        <span className="dot" />
        <span className="rate">
          {rateLabel(live.effectiveRate)} <span className="unit">NGN</span>
        </span>
        <span className="ago">{live.isStale ? "rate may be delayed" : agoLabel(live.ageSeconds)}</span>
      </div>

      {!CLERK_ENABLED && (
        <div className="demo">
          <span>View as</span>
          <div className="seg">
            {TIERS.map((t) => (
              <button key={t.key} className={tier === t.key ? "on" : ""} onClick={() => setTier(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
