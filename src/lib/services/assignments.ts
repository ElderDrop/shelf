import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListType, UserAssignment } from "@/types";

export type AssignmentServiceErrorCode = "not_found" | "forbidden" | "conflict" | "unknown";

export class AssignmentServiceError extends Error {
  readonly code: AssignmentServiceErrorCode;
  readonly cause?: unknown;

  constructor(code: AssignmentServiceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AssignmentServiceError";
    this.code = code;
    this.cause = cause;
  }
}

export interface AssignmentCatalogItem {
  title: string;
  description: string | null;
  tags: string[];
}

export interface AssignmentWithItem extends UserAssignment {
  catalog_item: AssignmentCatalogItem | null;
}

export interface AssignResult {
  assignment: UserAssignment;
  created: boolean;
}

interface AssignmentRow {
  id: string;
  user_id: string;
  catalog_item_id: string;
  list_type: ListType;
  created_at: string;
}

interface CatalogItemEmbed {
  title: string;
  description: string | null;
  tags: string[] | null;
}

interface AssignmentWithEmbedRow extends AssignmentRow {
  catalog_items: CatalogItemEmbed | CatalogItemEmbed[] | null;
}

function mapAssignment(row: AssignmentRow): UserAssignment {
  return {
    id: row.id,
    user_id: row.user_id,
    catalog_item_id: row.catalog_item_id,
    list_type: row.list_type,
    created_at: row.created_at,
  };
}

function mapEmbed(embed: CatalogItemEmbed | CatalogItemEmbed[] | null): AssignmentCatalogItem | null {
  const item = Array.isArray(embed) ? embed[0] : (embed ?? undefined);
  if (!item) return null;
  return {
    title: item.title,
    description: item.description,
    tags: item.tags ?? [],
  };
}

function mapWithItem(row: AssignmentWithEmbedRow): AssignmentWithItem {
  return {
    ...mapAssignment(row),
    catalog_item: mapEmbed(row.catalog_items),
  };
}

function mapPostgrestError(error: { code?: string; message: string }): AssignmentServiceError {
  if (error.code === "PGRST116") {
    return new AssignmentServiceError("not_found", "Assignment not found", error);
  }
  if (error.code === "42501" || error.message.toLowerCase().includes("permission")) {
    return new AssignmentServiceError("forbidden", "Not allowed to modify this assignment", error);
  }
  if (error.code === "23505") {
    return new AssignmentServiceError("conflict", "Assignment already exists", error);
  }
  return new AssignmentServiceError("unknown", error.message, error);
}

/** Lists up to PostgREST max_rows (default 1000); excess rows are truncated silently. */
export async function listForUser(client: SupabaseClient, listType?: ListType): Promise<AssignmentWithItem[]> {
  let query = client
    .from("user_assignments")
    .select("id, user_id, catalog_item_id, list_type, created_at, catalog_items(title, description, tags)")
    .order("created_at", { ascending: false });

  if (listType) {
    query = query.eq("list_type", listType);
  }

  const { data, error } = await query;

  if (error) {
    throw mapPostgrestError(error);
  }

  return (data as AssignmentWithEmbedRow[]).map(mapWithItem);
}

export async function listAssignmentStateForCatalog(
  client: SupabaseClient,
  catalogItemIds: string[],
): Promise<Map<string, ListType>> {
  const state = new Map<string, ListType>();
  if (catalogItemIds.length === 0) {
    return state;
  }

  const { data, error } = await client
    .from("user_assignments")
    .select("catalog_item_id, list_type")
    .in("catalog_item_id", catalogItemIds);

  if (error) {
    throw mapPostgrestError(error);
  }

  for (const row of data as { catalog_item_id: string; list_type: ListType }[]) {
    state.set(row.catalog_item_id, row.list_type);
  }

  return state;
}

export async function assign(client: SupabaseClient, catalogItemId: string, listType: ListType): Promise<AssignResult> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    throw new AssignmentServiceError("forbidden", "Authentication required", authError);
  }

  const { data: inserted, error: insertError } = await client
    .from("user_assignments")
    .insert({
      user_id: user.id,
      catalog_item_id: catalogItemId,
      list_type: listType,
    })
    .select("id, user_id, catalog_item_id, list_type, created_at")
    .single();

  if (!insertError) {
    return { assignment: mapAssignment(inserted), created: true };
  }

  if (insertError.code === "23505") {
    const { data: updated, error: updateError } = await client
      .from("user_assignments")
      .update({ list_type: listType })
      .eq("catalog_item_id", catalogItemId)
      .select("id, user_id, catalog_item_id, list_type, created_at")
      .maybeSingle();

    if (updateError) {
      throw mapPostgrestError(updateError);
    }

    if (!updated) {
      // Unique conflict but no visible/updatable row — typically rejected target (RLS WITH CHECK).
      throw new AssignmentServiceError("forbidden", "Cannot assign to a non-approved catalog item", updateError);
    }

    return { assignment: mapAssignment(updated), created: false };
  }

  // RLS WITH CHECK failure on non-approved target surfaces as permission / policy error.
  if (
    insertError.code === "42501" ||
    insertError.message.toLowerCase().includes("permission") ||
    insertError.message.toLowerCase().includes("policy") ||
    insertError.message.toLowerCase().includes("row-level security")
  ) {
    throw new AssignmentServiceError("forbidden", "Cannot assign to a non-approved catalog item", insertError);
  }

  throw mapPostgrestError(insertError);
}

export async function updateListType(
  client: SupabaseClient,
  assignmentId: string,
  listType: ListType,
): Promise<UserAssignment> {
  const { data, error } = await client
    .from("user_assignments")
    .update({ list_type: listType })
    .eq("id", assignmentId)
    .select("id, user_id, catalog_item_id, list_type, created_at")
    .maybeSingle();

  if (error) {
    throw mapPostgrestError(error);
  }

  if (!data) {
    throw new AssignmentServiceError("not_found", "Assignment not found");
  }

  return mapAssignment(data);
}

export async function remove(client: SupabaseClient, assignmentId: string): Promise<void> {
  const { data, error } = await client
    .from("user_assignments")
    .delete()
    .eq("id", assignmentId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw mapPostgrestError(error);
  }

  if (!data) {
    throw new AssignmentServiceError("not_found", "Assignment not found");
  }
}
