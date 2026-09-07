import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { jsonError, jsonOk } from "@/lib/api-response";
import { ShareServiceError, createOrRotateShareLink, getActiveShareLink, revokeShareLink } from "@/lib/services/share";

export const prerender = false;

function requireUser(context: Parameters<APIRoute>[0]) {
  if (!context.locals.user) {
    return jsonError(401, "Unauthorized");
  }
  return null;
}

function serviceErrorResponse(error: unknown) {
  if (error instanceof ShareServiceError) {
    if (error.code === "not_found") return jsonError(404, error.message);
    if (error.code === "unauthorized") return jsonError(401, error.message);
    if (error.code === "misconfigured") return jsonError(500, error.message);
  }
  return jsonError(500, "Unexpected error");
}

export const GET: APIRoute = async (context) => {
  const unauthorized = requireUser(context);
  if (unauthorized) return unauthorized;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError(500, "Supabase is not configured");
  }

  try {
    const link = await getActiveShareLink(supabase);
    if (!link) {
      return jsonOk({ active: false });
    }
    if (link.token) {
      const origin = new URL(context.request.url).origin;
      return jsonOk({
        active: true,
        created_at: link.created_at,
        url: `${origin}/share/${link.token}`,
      });
    }
    return jsonOk({ active: true, created_at: link.created_at });
  } catch (error) {
    return serviceErrorResponse(error);
  }
};

export const POST: APIRoute = async (context) => {
  const unauthorized = requireUser(context);
  if (unauthorized) return unauthorized;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError(500, "Supabase is not configured");
  }

  try {
    const result = await createOrRotateShareLink(supabase);
    const origin = new URL(context.request.url).origin;
    const url = `${origin}/share/${result.rawToken}`;
    return jsonOk(
      {
        url,
        token: result.rawToken,
        created_at: result.share.created_at,
      },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
};

export const DELETE: APIRoute = async (context) => {
  const unauthorized = requireUser(context);
  if (unauthorized) return unauthorized;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError(500, "Supabase is not configured");
  }

  try {
    await revokeShareLink(supabase);
    return jsonOk({ active: false });
  } catch (error) {
    return serviceErrorResponse(error);
  }
};
