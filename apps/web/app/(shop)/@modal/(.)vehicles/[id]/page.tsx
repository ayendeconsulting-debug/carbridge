import { notFound } from "next/navigation";
import { Modal } from "@/components/Modal";
import { VehicleDetail } from "@/components/VehicleDetail";
import { getVehicleDetail } from "@/lib/vehicles";
import { getCurrentSnapshot } from "@/lib/fx";
import { getTier } from "@/lib/tier";

export const dynamic = "force-dynamic";

export default async function VehicleModal({
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
  return (
    <Modal>
      <VehicleDetail v={v} fx={fx} tier={tier} inModal />
    </Modal>
  );
}
