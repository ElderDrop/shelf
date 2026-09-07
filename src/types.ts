export type AppRole = "user" | "admin";
export type CatalogStatus = "pending" | "approved" | "rejected";
export type ListType = "library" | "wishlist";

export interface Profile {
  id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface CatalogItem {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  status: CatalogStatus;
  created_at: string;
  updated_at: string;
}

export interface UserAssignment {
  id: string;
  user_id: string;
  catalog_item_id: string;
  list_type: ListType;
  created_at: string;
}

/**
 * Active share link for the owner.
 * Raw `token` is stored for re-disclosure after reload (null on legacy hash-only rows).
 * Authenticated GET builds `url` from token — do not return bare token on GET.
 */
export interface ShareLink {
  id: string;
  user_id: string;
  created_at: string;
  token: string | null;
}
