import { notFound } from "next/navigation";
import { VehicleDetail } from "@/components/VehicleDetail";
import { getVehicleDetail } from "@/lib/vehicles";
import { getCurrentSnapshot } from "@/lib/fx";
import { getTier } from "@/lib/tier";

export const dynamic = "force-dynamic";

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [v, fx, tier] = await Promise.all([
    getVehicleDetail(id),
    getCurrentSnapshot(),
    getTier(),
  ]);
  if (!v) notFound();
  return <VehicleDetail v={v} fx={fx} tier={tier} />;
}
