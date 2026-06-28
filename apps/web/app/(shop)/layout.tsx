import { AppHeader } from "@/components/AppHeader";
import { getTier } from "@/lib/tier";
import { getCurrentSnapshot } from "@/lib/fx";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function ShopLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  const [tier, fx] = await Promise.all([getTier(), getCurrentSnapshot()]);
  return (
    <div className="app">
      <AppHeader fx={fx} tier={tier} />
      {children}
      {modal}
    </div>
  );
}
