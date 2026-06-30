import { getAuthContext } from "@/lib/auth";
import { toggleFavorite, isFavorited } from "@/lib/favorites";

export const dynamic = "force-dynamic";

// GET /api/favorites?vehicleId=... -> { favorited } (used by the heart to sync
// its state where the server didn't pass an initial, e.g. the detail modal).
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx.userId) return Response.json({ favorited: false });
  const vehicleId = new URL(req.url).searchParams.get("vehicleId");
  if (!vehicleId) return Response.json({ error: "vehicleId is required" }, { status: 400 });
  return Response.json({ favorited: await isFavorited(ctx.userId, vehicleId) });
}

// POST /api/favorites { vehicleId } -> toggles, returns { favorited }.
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx.userId) {
    return Response.json({ error: "Sign in to save vehicles" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const vehicleId = String(body.vehicleId ?? "").trim();
  if (!vehicleId) return Response.json({ error: "vehicleId is required" }, { status: 400 });

  const r = await toggleFavorite(ctx.userId, vehicleId);
  return Response.json(r);
}
