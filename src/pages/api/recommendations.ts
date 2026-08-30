import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { jsonError, jsonOk } from "@/lib/api-response";
import { AssignmentServiceError } from "@/lib/services/assignments";
import { CatalogServiceError } from "@/lib/services/catalog";
import { RecommendationsServiceError, recommendForUser } from "@/lib/services/recommendations";

export const prerender = false;

function requireUser(context: Parameters<APIRoute>[0]) {
  if (!context.locals.user) {
    return jsonError(401, "Unauthorized");
  }
  return null;
}

function mapCodedServiceError(code: string, message: string) {
  if (code === "not_found") return jsonError(404, message);
  if (code === "forbidden") return jsonError(403, message);
  if (code === "conflict") return jsonError(400, message);
  return jsonError(500, message);
}

function serviceErrorResponse(error: unknown) {
  if (error instanceof AssignmentServiceError) {
    return mapCodedServiceError(error.code, error.message);
  }
  if (error instanceof CatalogServiceError) {
    return mapCodedServiceError(error.code, error.message);
  }
  if (error instanceof RecommendationsServiceError) {
    return jsonError(500, error.message);
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
    const result = await recommendForUser(supabase);
    return jsonOk(result);
  } catch (error) {
    return serviceErrorResponse(error);
  }
};
