import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { catalogCreateSchema, catalogStatusFilterSchema } from "@/lib/schemas/catalog";
import { CatalogServiceError, create, listAll } from "@/lib/services/catalog";
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

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError(500, "Supabase is not configured");
  }

  const statusParam = context.url.searchParams.get("status");
  let status: "pending" | "approved" | "rejected" | undefined;
  if (statusParam !== null) {
    const parsed = catalogStatusFilterSchema.safeParse(statusParam);
    if (!parsed.success) {
      return jsonError(400, "Validation failed", zodDetails(parsed.error));
    }
    status = parsed.data;
  }

  try {
    const items = await listAll(supabase, status);
    return jsonOk(items);
  } catch (error) {
    return serviceErrorResponse(error);
  }
};

export const POST: APIRoute = async (context) => {
  const forbidden = requireAdmin(context);
  if (forbidden) return forbidden;

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

  const parsed = catalogCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", zodDetails(parsed.error));
  }

  try {
    const item = await create(supabase, parsed.data);
    return jsonOk(item, 201);
  } catch (error) {
    return serviceErrorResponse(error);
  }
};
