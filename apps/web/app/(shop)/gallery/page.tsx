import { GalleryGrid } from "@/components/GalleryGrid";
import { getVehicleCards } from "@/lib/vehicles";
import { getCurrentSnapshot } from "@/lib/fx";
import { getAuthContext } from "@/lib/auth";
import { getFavoriteVehicleIds } from "@/lib/favorites";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [cards, fx, ctx] = await Promise.all([
    getVehicleCards(),
    getCurrentSnapshot(),
    getAuthContext(),
  ]);
  const favoritedIds = ctx.userId ? await getFavoriteVehicleIds(ctx.userId) : [];
  return <GalleryGrid cards={cards} fx={fx} favoritedIds={favoritedIds} />;
}
