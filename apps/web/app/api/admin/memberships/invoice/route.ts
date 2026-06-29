import { adminActor } from "@/lib/admin-guard";
import { issueMembershipInvoice } from "@/lib/invoicing";

export const dynamic = "force-dynamic";

// POST /api/admin/memberships/invoice — issue a MEMBERSHIP invoice for a buyer.
// Body: { userId: string, amount: string (NGN) }. Full payment (recorded via the
// normal payments route) grants Premium automatically.
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

  const r = await issueMembershipInvoice(userId, String(body.amount ?? ""), actor.actorId);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ invoiceId: r.invoiceId, number: r.number }, { status: 201 });
}
