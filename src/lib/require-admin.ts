import type { Profile } from "@/types";
import { jsonError } from "@/lib/api-response";

/** Minimal locals shape for admin API gates (no supabase / astro:env). */
export interface RequireAdminLocals {
  profile: Pick<Profile, "role"> | null | undefined;
}

export interface RequireAdminContext {
  locals: RequireAdminLocals;
}

/**
 * Returns a 403 JSON Response when the session profile is not admin; otherwise null.
 */
export function requireAdmin(context: RequireAdminContext): Response | null {
  if (context.locals.profile?.role !== "admin") {
    return jsonError(403, "Forbidden");
  }
  return null;
}
