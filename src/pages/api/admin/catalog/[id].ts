import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { catalogItemIdSchema, catalogUpdateSchema } from "@/lib/schemas/catalog";
import { CatalogServiceError, getById, update } from "@/lib/services/catalog";
import { ZodError } from "zod";

export const prerender = false;

function zodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

function serviceErrorResponse(error: unknown) {
  if (error instanceof CatalogServiceError) {
    if (error.code === "not_found") return jsonError(404, error.message);
    if (error.code === "forbidden") return jsonError(403, error.message);
    if (error.code === "conflict") return jsonError(400, error.message);
  }
  return jsonError(500, "Unexpected error");
}

export const GET: APIRoute = async (context) => {
  const forbidden = requireAdmin(context);
  if (forbidden) return forbidden;

  const idParsed = catalogItemIdSchema.safeParse(context.params.id);
  if (!idParsed.success) {
    return jsonError(400, "Validation failed", [{ field: "id", message: "Invalid UUID" }]);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError(500, "Supabase is not configured");
  }

  try {
    const item = await getById(supabase, idParsed.data);
    return jsonOk(item);
  } catch (error) {
    return serviceErrorResponse(error);
  }
};

export const PATCH: APIRoute = async (context) => {
  const forbidden = requireAdmin(context);
  if (forbidden) return forbidden;

  const idParsed = catalogItemIdSchema.safeParse(context.params.id);
  if (!idParsed.success) {
    return jsonError(400, "Validation failed", [{ field: "id", message: "Invalid UUID" }]);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError(500, "Supabase is not configured");
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  // Reject explicit pending before the schema so the error field is clear
  if (body && typeof body === "object" && "status" in body && (body as { status?: unknown }).status === "pending") {
    return jsonError(400, "Validation failed", [{ field: "status", message: "status cannot be set to pending" }]);
  }

  const parsed = catalogUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", zodDetails(parsed.error));
  }

  try {
    const item = await update(supabase, idParsed.data, parsed.data);
    return jsonOk(item);
  } catch (error) {
    return serviceErrorResponse(error);
  }
};
