import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { jsonError, jsonOk } from "@/lib/api-response";
import { assignmentIdSchema, assignmentUpdateSchema } from "@/lib/schemas/assignment";
import { AssignmentServiceError, remove, updateListType } from "@/lib/services/assignments";
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

export const PATCH: APIRoute = async (context) => {
  const unauthorized = requireUser(context);
  if (unauthorized) return unauthorized;

  const idParsed = assignmentIdSchema.safeParse(context.params.id);
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

  const parsed = assignmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", zodDetails(parsed.error));
  }

  try {
    const assignment = await updateListType(supabase, idParsed.data, parsed.data.list_type);
    return jsonOk(assignment);
  } catch (error) {
    return serviceErrorResponse(error);
  }
};

export const DELETE: APIRoute = async (context) => {
  const unauthorized = requireUser(context);
  if (unauthorized) return unauthorized;

  const idParsed = assignmentIdSchema.safeParse(context.params.id);
  if (!idParsed.success) {
    return jsonError(400, "Validation failed", [{ field: "id", message: "Invalid UUID" }]);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonError(500, "Supabase is not configured");
  }

  try {
    await remove(supabase, idParsed.data);
    return new Response(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
};
