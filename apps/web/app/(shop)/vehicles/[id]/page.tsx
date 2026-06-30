import { notFound } from "next/navigation";
import { VehicleDetail } from "@/components/VehicleDetail";
import { getVehicleDetail } from "@/lib/vehicles";
import { getCurrentSnapshot } from "@/lib/fx";
import { getTier } from "@/lib/tier";
import { getAuthContext } from "@/lib/auth";
import { isFavorited } from "@/lib/favorites";

export const dynamic = "force-dynamic";

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [v, fx, tier, ctx] = await Promise.all([
    getVehicleDetail(id),
    getCurrentSnapshot(),
    getTier(),
    getAuthContext(),
  ]);
  if (!v) notFound();
  const favorited = ctx.userId ? await isFavorited(ctx.userId, id) : false;
  return <VehicleDetail v={v} fx={fx} tier={tier} favorited={favorited} />;
}
