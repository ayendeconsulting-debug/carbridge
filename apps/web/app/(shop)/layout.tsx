import { AppHeader } from "@/components/AppHeader";
import { getAuthContext } from "@/lib/auth";
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
  const [ctx, fx] = await Promise.all([getAuthContext(), getCurrentSnapshot()]);
  return (
    <div className="app">
      <AppHeader fx={fx} tier={ctx.tier} isAdmin={ctx.isAdmin} />
      {children}
      {modal}
    </div>
  );
}
