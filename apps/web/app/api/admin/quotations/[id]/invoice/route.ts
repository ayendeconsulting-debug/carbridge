import { adminActor } from "@/lib/admin-guard";
import { issueInvoiceForQuotation } from "@/lib/invoicing";

export const dynamic = "force-dynamic";

// POST /api/admin/quotations/[id]/invoice - convert an issued quotation into a
// CB-INV invoice (NGN, bank instructions attached).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await adminActor();
  if (!actor) return Response.json({ error: "Admin required" }, { status: 403 });
  const { id } = await params;

  const r = await issueInvoiceForQuotation(id, actor.actorId);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ invoiceId: r.invoiceId, number: r.number }, { status: 201 });
}
