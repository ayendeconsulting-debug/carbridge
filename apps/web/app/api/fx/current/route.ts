import { getCurrentSnapshot } from "@/lib/fx";

export const dynamic = "force-dynamic";

export async function GET() {
  const snap = await getCurrentSnapshot();
  return Response.json(snap);
}
