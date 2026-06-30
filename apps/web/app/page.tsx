import { Landing } from "@/components/Landing";
import { getVehicleCards } from "@/lib/vehicles";
import { getCurrentSnapshot } from "@/lib/fx";
import { getAuthContext } from "@/lib/auth";
import { getFavoriteVehicleIds } from "@/lib/favorites";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [cards, fx, ctx] = await Promise.all([
    getVehicleCards(),
    getCurrentSnapshot(),
    getAuthContext(),
  ]);
  const recent = cards.slice(0, 3);
  const favoritedIds = ctx.userId ? await getFavoriteVehicleIds(ctx.userId) : [];
  return <Landing recent={recent} fx={fx} favoritedIds={favoritedIds} />;
}
