"use client";

import { useRouter } from "next/navigation";
import { ADMIN_COOKIE } from "@/lib/constants";

export function AdminGate() {
  const router = useRouter();
  const enter = () => {
    document.cookie = `${ADMIN_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}`;
    router.refresh();
  };
  return (
    <div style={{ maxWidth: 420, margin: "80px auto 0", padding: "0 20px", textAlign: "center" }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--steel-dim)" }}>
        Ayende Autos · Operations
      </div>
      <h1 className="exp" style={{ fontSize: 24, fontWeight: 800, margin: "10px 0 8px" }}>Admin console</h1>
      <p style={{ color: "var(--steel)", marginBottom: 22, lineHeight: 1.6 }}>
        This is a gated operations area for responding to offers and reservations. Demo access uses a local stub - replace with Clerk roles for production.
      </p>
      <button className="btn btn-buy" style={{ width: "100%" }} onClick={enter}>
        Enter admin mode (demo)
      </button>
    </div>
  );
}
