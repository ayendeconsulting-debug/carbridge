import { getAuthContext } from "./auth";

export interface AdminActor {
  /** DB User.id of the admin, when resolvable - written to AuditLog.actorId. */
  actorId: string | null;
}

/**
 * Single guard for catalog admin routes. Returns the admin actor, or null when
 * the caller is not an admin. Mirrors lib/admin.isAdmin() but also surfaces the
 * actor id so mutations can attribute their AuditLog entries (the older response
 * routes left actorId null).
 */
export async function adminActor(): Promise<AdminActor | null> {
  const ctx = await getAuthContext();
  if (!ctx.isAdmin) return null;
  return { actorId: ctx.userId };
}
