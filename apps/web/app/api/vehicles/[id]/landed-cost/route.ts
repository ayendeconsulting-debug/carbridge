import { type ShippingMethod } from "@carbridge/shared";
import { computeAuthoritativeLanded } from "@/lib/landed";

export const dynamic = "force-dynamic";

// Server-authoritative landed total (SRD FR-CST-05). The client displays
// optimistically and reconciles against this before any offer/reservation.
// Delegates to computeAuthoritativeLanded so the offer/reservation routes lock
// the exact same figures this endpoint reports.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const method = url.searchParams.get("method") as ShippingMethod | null;

  const result = await computeAuthoritativeLanded(id, method);
  if (!result) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({
    vehicleId: id,
    method: result.method,
    ...result.serialized,
    fxRate: result.fxRate,
  });
}
