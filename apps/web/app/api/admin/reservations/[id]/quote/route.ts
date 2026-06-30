import { adminActor } from "@/lib/admin-guard";
import { issueQuotationForReservation } from "@/lib/invoicing";

export const dynamic = "force-dynamic";

// POST /api/admin/reservations/[id]/quote - issue a CB-Q quotation from a
// reservation, snapshotting its locked landed total.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await adminActor();
  if (!actor) return Response.json({ error: "Admin required" }, { status: 403 });
  const { id } = await params;

  const r = await issueQuotationForReservation(id, actor.actorId);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ quotationId: r.quotationId, number: r.number }, { status: 201 });
}
