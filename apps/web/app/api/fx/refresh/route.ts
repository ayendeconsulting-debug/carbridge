import { refreshAndStore } from "@/lib/fx";

export const dynamic = "force-dynamic";

// Called by an EXTERNAL scheduler (GitHub Actions) every ~10 min, since Vercel
// Hobby cron is daily-only. Guard with a bearer secret.
export async function POST(req: Request) {
  const secret = process.env.FX_REFRESH_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const snap = await refreshAndStore();
    return Response.json(snap);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "refresh failed" },
      { status: 502 },
    );
  }
}
