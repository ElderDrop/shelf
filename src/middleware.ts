import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/catalog", "/admin", "/library", "/wishlist"];
const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: JSON_HEADERS });
}

function isApiAdmin(pathname: string) {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

function isApiAssignments(pathname: string) {
  return pathname === "/api/assignments" || pathname.startsWith("/api/assignments/");
}

function isApiRecommendations(pathname: string) {
  return pathname === "/api/recommendations" || pathname.startsWith("/api/recommendations/");
}

function isApiShare(pathname: string) {
  return pathname === "/api/share" || pathname.startsWith("/api/share/");
}

function isAdminPage(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);
  const pathname = context.url.pathname;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;

    if (user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, created_at, updated_at")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("profiles lookup failed:", error.message);
        context.locals.profile = null;
        // Fail closed on admin surfaces — do not treat as non-admin (would 403).
        if (isApiAdmin(pathname)) {
          return jsonError(500, "Profile lookup failed");
        }
        if (isAdminPage(pathname)) {
          return new Response("Profile lookup failed", {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      } else {
        context.locals.profile = data ?? null;
      }
    } else {
      context.locals.profile = null;
    }
  } else {
    context.locals.user = null;
    context.locals.profile = null;
  }

  const isAdmin = context.locals.profile?.role === "admin";

  // Primary admin API gate — must stay aligned with requireAdmin() in src/lib/require-admin.ts
  if (isApiAdmin(pathname)) {
    if (!context.locals.user) {
      return jsonError(401, "Unauthorized");
    }
    if (!isAdmin) {
      return jsonError(403, "Forbidden");
    }
    return next();
  }

  if (isApiAssignments(pathname)) {
    if (!context.locals.user) {
      return jsonError(401, "Unauthorized");
    }
    return next();
  }

  if (isApiRecommendations(pathname)) {
    if (!context.locals.user) {
      return jsonError(401, "Unauthorized");
    }
    return next();
  }

  if (isApiShare(pathname)) {
    if (!context.locals.user) {
      return jsonError(401, "Unauthorized");
    }
    return next();
  }

  if (isAdminPage(pathname)) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
    if (!isAdmin) {
      const page = await context.rewrite("/403");
      return new Response(page.body, { status: 403, headers: page.headers });
    }
    return next();
  }

  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
