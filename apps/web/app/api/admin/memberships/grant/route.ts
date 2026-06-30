import { adminActor } from "@/lib/admin-guard";
import { grantPremium } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

// POST /api/admin/memberships/grant - admin grants Premium directly (1 year,
// extends from current expiry if still active). Body: { userId: string }
export async function POST(req: Request) {
  const actor = await adminActor();
  if (!actor) return Response.json({ error: "Admin required" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  if (!userId) return Response.json({ error: "A buyer is required" }, { status: 400 });

  try {
    const r = await grantPremium(userId, {}, actor.actorId);
    return Response.json({ expiresAt: r.expiresAt, created: r.created }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not grant Premium" }, { status: 500 });
  }
}
