import type { SupabaseClient } from "@supabase/supabase-js";
import { listApproved } from "@/lib/services/catalog";
import { listForUser, type AssignmentWithItem } from "@/lib/services/assignments";
import {
  buildLibraryTagSet,
  countTaggedLibraryItems,
  rankCandidates,
  type RecommendationSeed,
  type ScoredRecommendation,
} from "@/lib/recommendations/score";

export type RecommendationsServiceErrorCode = "unknown";

export class RecommendationsServiceError extends Error {
  readonly code: RecommendationsServiceErrorCode;
  readonly cause?: unknown;

  constructor(code: RecommendationsServiceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "RecommendationsServiceError";
    this.code = code;
    this.cause = cause;
  }
}

export interface RecommendationResult {
  eligible: boolean;
  taggedLibraryCount: number;
  items: ScoredRecommendation[];
}

export interface RecommendForUserOptions {
  /** When provided (e.g. from /library SSR), skips a second listForUser round-trip. Must include library + wishlist for exclusions. */
  assignments?: AssignmentWithItem[];
}

function mapAssignmentToSeed(
  catalogItemId: string,
  catalogItem: { title: string; description: string | null; tags: string[] } | null,
): RecommendationSeed | null {
  if (!catalogItem) {
    return null;
  }
  return {
    id: catalogItemId,
    title: catalogItem.title,
    description: catalogItem.description,
    tags: catalogItem.tags,
  };
}

/** Uses listApproved (≤ PostgREST max_rows, default 1000); excess catalog rows are truncated silently. */
export async function recommendForUser(
  client: SupabaseClient,
  options: RecommendForUserOptions = {},
): Promise<RecommendationResult> {
  const assignments = options.assignments ?? (await listForUser(client));

  const assignedCatalogItemIds = new Set(assignments.map((row) => row.catalog_item_id));

  const seeds: RecommendationSeed[] = [];
  for (const row of assignments) {
    if (row.list_type !== "library") {
      continue;
    }
    const seed = mapAssignmentToSeed(row.catalog_item_id, row.catalog_item);
    if (seed) {
      seeds.push(seed);
    }
  }

  const taggedLibraryCount = countTaggedLibraryItems(seeds);
  if (taggedLibraryCount < 3) {
    return { eligible: false, taggedLibraryCount, items: [] };
  }

  const approvedCatalog = await listApproved(client);
  const candidates = approvedCatalog
    .filter((item) => !assignedCatalogItemIds.has(item.id))
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      tags: item.tags,
    }));

  const libraryTagSet = buildLibraryTagSet(seeds);
  const items = rankCandidates(candidates, libraryTagSet);

  return { eligible: true, taggedLibraryCount, items };
}
