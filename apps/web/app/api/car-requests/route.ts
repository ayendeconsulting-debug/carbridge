import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Premium-gated Source-a-Car request. Identity via getAuthContext (Clerk session
// or dev-bypass).
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (ctx.tier !== "PREMIUM" || !ctx.userId) {
    return Response.json({ error: "Premium required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const budgetAmount = String(body.budgetAmount ?? "").trim();
  if (!budgetAmount || Number(budgetAmount) <= 0) {
    return Response.json({ error: "A budget amount is required" }, { status: 400 });
  }
  const budgetCurrency = body.budgetCurrency === "CAD" ? "CAD" : "NGN";

  const userId = ctx.userId;

  const created = await prisma.carRequest.create({
    data: {
      userId,
      make: (body.make as string) ?? null,
      model: (body.model as string) ?? null,
      yearMin: (body.yearMin as number) ?? null,
      yearMax: (body.yearMax as number) ?? null,
      bodyType: (body.bodyType as never) ?? null,
      maxMileageKm: (body.maxMileageKm as number) ?? null,
      budgetAmount,
      budgetCurrency,
      notes: (body.notes as string) ?? null,
    },
  });

  return Response.json({ id: created.id, status: created.status }, { status: 201 });
}
