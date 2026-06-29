import { adminActor } from "@/lib/admin-guard";
import { recordPayment } from "@/lib/invoicing";

export const dynamic = "force-dynamic";

// POST /api/admin/invoices/[id]/payments — record a manual bank payment.
// Body: { amount: string (NGN), reference: string, paidAt?: ISO, note?: string }
// Dedup is by reference; full payment auto-confirms the reservation + SOLD.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await adminActor();
  if (!actor) return Response.json({ error: "Admin required" }, { status: 403 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const r = await recordPayment(
    id,
    {
      amount: String(body.amount ?? ""),
      reference: String(body.reference ?? ""),
      paidAt: typeof body.paidAt === "string" ? body.paidAt : null,
      note: typeof body.note === "string" ? body.note : null,
    },
    actor.actorId,
  );
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(
    {
      invoiceStatus: r.invoiceStatus,
      amountPaid: r.amountPaid,
      reservationAdvanced: r.reservationAdvanced,
      premiumGranted: r.premiumGranted,
    },
    { status: 201 },
  );
}
