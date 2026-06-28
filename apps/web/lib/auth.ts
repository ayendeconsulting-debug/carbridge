import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import { TIER_COOKIE, ADMIN_COOKIE } from "./constants";
import type { Tier } from "./types";

export interface AuthContext {
  /** DB user id (not the Clerk id). Null when nobody is resolved. */
  userId: string | null;
  tier: Tier;
  isAdmin: boolean;
  email: string | null;
  authenticated: boolean;
}

const TIERS: Tier[] = ["GUEST", "REGISTERED", "PREMIUM"];

const GUEST: AuthContext = {
  userId: null,
  tier: "GUEST",
  isAdmin: false,
  email: null,
  authenticated: false,
};

/** True only when both Clerk keys are configured (server-side check). */
export function clerkEnabled(): boolean {
  return (
    !!process.env.CLERK_SECRET_KEY &&
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );
}

async function clerkContext(): Promise<AuthContext> {
  const { userId: clerkId, sessionClaims } = await auth();
  if (!clerkId) return GUEST;

  // Role from session claims if the token is customised to include
  // public_metadata (see runbook); otherwise we fall back to the API.
  const roleFromClaims = (sessionClaims as { metadata?: { role?: string } } | null)
    ?.metadata?.role;
  let isAdmin = roleFromClaims === "admin";

  let dbUser = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, tier: true, email: true },
  });

  // Only hit the Clerk API when we must (role not in claims, or user not synced).
  if (!dbUser || roleFromClaims === undefined) {
    const cu = await currentUser();
    if (roleFromClaims === undefined) {
      const role = (cu?.publicMetadata as { role?: string } | undefined)?.role;
      isAdmin = role === "admin";
    }
    if (!dbUser) {
      const email =
        cu?.primaryEmailAddress?.emailAddress ??
        cu?.emailAddresses?.[0]?.emailAddress ??
        `${clerkId}@clerk.local`;
      const name = cu ? [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null : null;
      dbUser = await prisma.user.upsert({
        where: { clerkId },
        update: {},
        create: { clerkId, email, name, tier: "REGISTERED" },
        select: { id: true, tier: true, email: true },
      });
    }
  }

  return {
    userId: dbUser.id,
    tier: dbUser.tier as Tier,
    isAdmin,
    email: dbUser.email,
    authenticated: true,
  };
}

async function bypassContext(): Promise<AuthContext> {
  const store = await cookies();
  const raw = store.get(TIER_COOKIE)?.value as Tier | undefined;
  const tier: Tier = raw && TIERS.includes(raw) ? raw : "REGISTERED";
  const adminRaw = store.get(ADMIN_COOKIE)?.value;
  const isAdmin = adminRaw === "1" || adminRaw === "true";

  // Anchor to the seeded demo user matching the selected tier.
  const user = await prisma.user.findFirst({
    where: { tier: tier === "PREMIUM" ? "PREMIUM" : "REGISTERED" },
    select: { id: true, email: true },
  });

  return {
    userId: user?.id ?? null,
    tier,
    isAdmin,
    email: user?.email ?? null,
    authenticated: !!user,
  };
}

/** The single source of truth for who the caller is and what they may do. */
export async function getAuthContext(): Promise<AuthContext> {
  return clerkEnabled() ? clerkContext() : bypassContext();
}

export function isAtLeastPremium(ctx: AuthContext): boolean {
  return ctx.tier === "PREMIUM";
}
