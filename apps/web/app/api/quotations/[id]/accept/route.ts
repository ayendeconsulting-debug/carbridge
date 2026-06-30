import { acceptQuotationByBuyer } from "@/lib/invoicing";
import { getCurrentUser } from "@/lib/account";

export const dynamic = "force-dynamic";

// POST /api/quotations/[id]/accept — buyer accepts their issued quotation. This
// is the gate the admin needs before invoicing. Owner-checked inside the lib fn.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const r = await acceptQuotationByBuyer(id, user.id);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ status: r.status });
}
