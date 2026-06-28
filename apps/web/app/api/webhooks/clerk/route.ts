import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface ClerkUserEvent {
  type: string;
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: { id: string; email_address: string }[];
  };
}

// Clerk -> DB user sync (FR-MEM-01). Verified with svix using CLERK_WEBHOOK_SECRET.
// Kept public in middleware; it authenticates itself via the signature.
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "webhook not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let evt: ClerkUserEvent;
  try {
    evt = new Webhook(secret).verify(payload, headers) as ClerkUserEvent;
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const d = evt.data;
    const email =
      d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address ??
      d.email_addresses?.[0]?.email_address ??
      `${d.id}@clerk.local`;
    const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || null;

    await prisma.user.upsert({
      where: { clerkId: d.id },
      update: { email, name },
      create: { clerkId: d.id, email, name, tier: "REGISTERED" },
    });
  }

  return Response.json({ received: true });
}
