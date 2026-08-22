import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogItem, CatalogStatus } from "@/types";
import type { CatalogCreateInput, CatalogUpdateInput } from "@/lib/schemas/catalog";

export type CatalogServiceErrorCode = "not_found" | "forbidden" | "conflict" | "unknown";

export class CatalogServiceError extends Error {
  readonly code: CatalogServiceErrorCode;
  readonly cause?: unknown;

  constructor(code: CatalogServiceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "CatalogServiceError";
    this.code = code;
    this.cause = cause;
  }
}

interface CatalogRow {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  status: CatalogStatus;
  created_at: string;
  updated_at: string;
}

function mapRow(row: CatalogRow): CatalogItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags ?? [],
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapPostgrestError(error: { code?: string; message: string }): CatalogServiceError {
  if (error.code === "PGRST116") {
    return new CatalogServiceError("not_found", "Catalog item not found", error);
  }
  if (error.code === "42501" || error.message.toLowerCase().includes("permission")) {
    return new CatalogServiceError("forbidden", "Not allowed to access catalog items", error);
  }
  if (error.code === "23505") {
    return new CatalogServiceError("conflict", "Catalog item conflict", error);
  }
  return new CatalogServiceError("unknown", error.message, error);
}

export async function listApproved(client: SupabaseClient): Promise<CatalogItem[]> {
  const { data, error } = await client
    .from("catalog_items")
    .select("id, title, description, tags, status, created_at, updated_at")
    .eq("status", "approved")
    .order("updated_at", { ascending: false });

  if (error) {
    throw mapPostgrestError(error);
  }

  return (data as CatalogRow[]).map(mapRow);
}

export async function listAll(client: SupabaseClient, status?: CatalogStatus): Promise<CatalogItem[]> {
  let query = client
    .from("catalog_items")
    .select("id, title, description, tags, status, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw mapPostgrestError(error);
  }

  return (data as CatalogRow[]).map(mapRow);
}

export async function getById(client: SupabaseClient, id: string): Promise<CatalogItem> {
  const { data, error } = await client
    .from("catalog_items")
    .select("id, title, description, tags, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw mapPostgrestError(error);
  }

  if (!data) {
    throw new CatalogServiceError("not_found", "Catalog item not found");
  }

  return mapRow(data);
}

export async function create(client: SupabaseClient, input: CatalogCreateInput): Promise<CatalogItem> {
  const { data, error } = await client
    .from("catalog_items")
    .insert({
      title: input.title,
      description: input.description ?? null,
      tags: input.tags,
      status: "pending",
    })
    .select("id, title, description, tags, status, created_at, updated_at")
    .single();

  if (error) {
    throw mapPostgrestError(error);
  }

  return mapRow(data);
}

export async function update(client: SupabaseClient, id: string, input: CatalogUpdateInput): Promise<CatalogItem> {
  const patch: {
    title?: string;
    description?: string | null;
    tags?: string[];
    status?: "approved" | "rejected";
  } = {};

  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await client
    .from("catalog_items")
    .update(patch)
    .eq("id", id)
    .select("id, title, description, tags, status, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw mapPostgrestError(error);
  }

  if (!data) {
    throw new CatalogServiceError("not_found", "Catalog item not found");
  }

  return mapRow(data);
}
