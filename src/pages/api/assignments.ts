import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { jsonError, jsonOk } from "@/lib/api-response";
import { assignmentCreateSchema, assignmentListFilterSchema } from "@/lib/schemas/assignment";
import { AssignmentServiceError, assign, listForUser } from "@/lib/services/assignments";
import { ZodError } from "zod";

export const prerender = false;

function requireUser(context: Parameters<APIRoute>[0]) {
  if (!context.locals.user) {
    return jsonError(401, "Unauthorized");
  }
  return null;
}

function zodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

function serviceErrorResponse(error: unknown) {
  if (error instanceof AssignmentServiceError) {
    if (error.code === "not_found") return jsonError(404, error.message);
    if (error.code === "forbidden") return jsonError(403, error.message);
    if (error.code === "conflict") return jsonError(400, error.message);
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

  const listTypeParam = context.url.searchParams.get("list_type");
  let listType: "library" | "wishlist" | undefined;
  if (listTypeParam !== null) {
    const parsed = assignmentListFilterSchema.safeParse(listTypeParam);
    if (!parsed.success) {
      return jsonError(400, "Validation failed", zodDetails(parsed.error));
    }
    listType = parsed.data;
  }

  try {
    const assignments = await listForUser(supabase, listType);
    return jsonOk(assignments);
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

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = assignmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", zodDetails(parsed.error));
  }

  try {
    const result = await assign(supabase, parsed.data.catalog_item_id, parsed.data.list_type);
    return jsonOk(result.assignment, result.created ? 201 : 200);
  } catch (error) {
    return serviceErrorResponse(error);
  }
};
