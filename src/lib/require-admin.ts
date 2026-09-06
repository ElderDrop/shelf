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
 *
 * Defense-in-depth for admin API routes. Middleware performs the primary gate
 * (`src/middleware.ts` — `isApiAdmin` branch) and returns 401 when there is no
 * session user; this helper only runs after that and treats missing/non-admin
 * profile as 403. Keep both checks aligned.
 */
export function requireAdmin(context: RequireAdminContext): Response | null {
  if (context.locals.profile?.role !== "admin") {
    return jsonError(403, "Forbidden");
  }
  return null;
}
