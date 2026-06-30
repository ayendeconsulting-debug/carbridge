import { getAuthContext } from "@/lib/auth";
import { getWatching } from "@/lib/favorites";

export const dynamic = "force-dynamic";

// GET /api/favorites/watching -> WatchingItemView[] (each saved vehicle,
// recomputed live and diffed against its save-time snapshot).
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.userId) return Response.json({ items: [] });
  const items = await getWatching(ctx.userId);
  return Response.json({ items });
}
