import { GalleryGrid } from "@/components/GalleryGrid";
import { getVehicleCards } from "@/lib/vehicles";
import { getCurrentSnapshot } from "@/lib/fx";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [cards, fx] = await Promise.all([getVehicleCards(), getCurrentSnapshot()]);
  return <GalleryGrid cards={cards} fx={fx} />;
}
