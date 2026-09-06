import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase-service";
import type { ListType, ShareLink } from "@/types";

export type ShareServiceErrorCode = "not_found" | "unauthorized" | "misconfigured" | "unknown";

export class ShareServiceError extends Error {
  readonly code: ShareServiceErrorCode;
  readonly cause?: unknown;

  constructor(code: ShareServiceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ShareServiceError";
    this.code = code;
    this.cause = cause;
  }
}

export interface ShareCatalogItem {
  title: string;
  description: string | null;
  tags: string[];
}

export interface ShareAssignmentItem {
  list_type: ListType;
  catalog_item: ShareCatalogItem;
}

export interface ResolvedShare {
  library: ShareAssignmentItem[];
  wishlist: ShareAssignmentItem[];
}

export interface CreateOrRotateResult {
  share: ShareLink;
  rawToken: string;
  created: boolean;
}

interface ShareLinkRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
}

interface CatalogEmbed {
  title: string;
  description: string | null;
  tags: string[] | null;
  status?: string;
}

interface AssignmentResolveRow {
  list_type: ListType;
  catalog_items: CatalogEmbed | CatalogEmbed[] | null;
}

function mapShareLink(row: ShareLinkRow): ShareLink {
  return {
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
  };
}

function mapPostgrestError(error: { code?: string; message: string }): ShareServiceError {
  if (error.code === "PGRST116") {
    return new ShareServiceError("not_found", "Share link not found", error);
  }
  return new ShareServiceError("unknown", error.message, error);
}

/** Hex SHA-256 of UTF-8 token bytes (Web Crypto — workerd-safe). */
export async function hashShareToken(rawToken: string): Promise<string> {
  const data = new TextEncoder().encode(rawToken);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** URL-safe opaque token (~256 bits). */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new ShareServiceError("unauthorized", "Not authenticated", error);
  }
  return user.id;
}

/** Owner: active link metadata (no raw token). */
export async function getActiveShareLink(client: SupabaseClient): Promise<ShareLink | null> {
  const userId = await requireUserId(client);
  const { data, error } = await client
    .from("share_links")
    .select("id, user_id, token_hash, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw mapPostgrestError(error);
  }
  if (!data) {
    return null;
  }
  return mapShareLink(data);
}

/**
 * Owner: create or rotate — always issues a new raw token.
 * Deletes any existing row for the user, then inserts.
 */
export async function createOrRotateShareLink(client: SupabaseClient): Promise<CreateOrRotateResult> {
  const userId = await requireUserId(client);
  const existing = await client.from("share_links").select("id").eq("user_id", userId).maybeSingle();
  if (existing.error) {
    throw mapPostgrestError(existing.error);
  }
  const hadPrior = Boolean(existing.data);

  if (hadPrior) {
    const { error: deleteError } = await client.from("share_links").delete().eq("user_id", userId);
    if (deleteError) {
      throw mapPostgrestError(deleteError);
    }
  }

  const rawToken = generateShareToken();
  const tokenHash = await hashShareToken(rawToken);

  const { data, error } = await client
    .from("share_links")
    .insert({ user_id: userId, token_hash: tokenHash })
    .select("id, user_id, token_hash, created_at")
    .single();

  if (error) {
    throw mapPostgrestError(error);
  }

  return {
    share: mapShareLink(data),
    rawToken,
    created: !hadPrior,
  };
}

/** Owner: delete-on-revoke (idempotent). */
export async function revokeShareLink(client: SupabaseClient): Promise<void> {
  const userId = await requireUserId(client);
  const { error } = await client.from("share_links").delete().eq("user_id", userId);
  if (error) {
    throw mapPostgrestError(error);
  }
}

function mapEmbed(embed: CatalogEmbed | CatalogEmbed[] | null): ShareCatalogItem | null {
  const item = Array.isArray(embed) ? embed[0] : (embed ?? undefined);
  if (!item) return null;
  return {
    title: item.title,
    description: item.description,
    tags: item.tags ?? [],
  };
}

/**
 * Public resolve via service-role client only.
 * Never call listForUser here — must filter user_id + approved catalog.
 */
export async function resolveShareByToken(rawToken: string): Promise<ResolvedShare> {
  const service = createServiceClient();
  if (!service) {
    throw new ShareServiceError("misconfigured", "Share resolve is not configured");
  }

  const tokenHash = await hashShareToken(rawToken);
  const { data: link, error: linkError } = await service
    .from("share_links")
    .select("id, user_id, token_hash, created_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) {
    throw mapPostgrestError(linkError);
  }
  if (!link) {
    throw new ShareServiceError("not_found", "Share link is invalid or has been revoked");
  }

  const ownerId = mapShareLink(link).user_id;

  const { data: rows, error: assignError } = await service
    .from("user_assignments")
    .select("list_type, catalog_items!inner(title, description, tags, status)")
    .eq("user_id", ownerId)
    .eq("catalog_items.status", "approved")
    .order("created_at", { ascending: false });

  if (assignError) {
    throw mapPostgrestError(assignError);
  }

  const library: ShareAssignmentItem[] = [];
  const wishlist: ShareAssignmentItem[] = [];

  for (const row of (rows as AssignmentResolveRow[] | null) ?? []) {
    const catalog_item = mapEmbed(row.catalog_items);
    if (!catalog_item) continue;
    const item: ShareAssignmentItem = { list_type: row.list_type, catalog_item };
    if (row.list_type === "library") {
      library.push(item);
    } else {
      wishlist.push(item);
    }
  }

  return { library, wishlist };
}
