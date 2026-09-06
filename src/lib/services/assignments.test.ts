import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AssignmentServiceError, assertNotLibraryToWishlist, assign, updateListType } from "@/lib/services/assignments";
import { callsNamed, createSupabaseQueryMock } from "@/lib/services/__tests__/supabase-query-mock";
import type { ListType } from "@/types";

const ASSIGNMENT_ID = "22222222-2222-4222-8222-222222222222";
const CATALOG_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "00000000-0000-4000-8000-000000000099";

function row(listType: ListType) {
  return {
    id: ASSIGNMENT_ID,
    user_id: USER_ID,
    catalog_item_id: CATALOG_ID,
    list_type: listType,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("assertNotLibraryToWishlist demotion rule", () => {
  it("throws forbidden when demoting library to wishlist", () => {
    expect(() => {
      assertNotLibraryToWishlist("library", "wishlist");
    }).toThrow(AssignmentServiceError);
    try {
      assertNotLibraryToWishlist("library", "wishlist");
    } catch (error) {
      expect(error).toBeInstanceOf(AssignmentServiceError);
      expect((error as AssignmentServiceError).code).toBe("forbidden");
      expect((error as AssignmentServiceError).message).toBe("Cannot move a library item to wishlist");
    }
  });

  it("allows wishlist to library and same-type no-ops", () => {
    expect(() => {
      assertNotLibraryToWishlist("wishlist", "library");
    }).not.toThrow();
    expect(() => {
      assertNotLibraryToWishlist("library", "library");
    }).not.toThrow();
    expect(() => {
      assertNotLibraryToWishlist("wishlist", "wishlist");
    }).not.toThrow();
  });
});

describe("updateListType library→wishlist demotion", () => {
  it("rejects demotion and does not call update", async () => {
    const { client, calls } = createSupabaseQueryMock({
      results: [{ data: row("library"), error: null }],
    });

    await expect(updateListType(client as unknown as SupabaseClient, ASSIGNMENT_ID, "wishlist")).rejects.toMatchObject({
      name: "AssignmentServiceError",
      code: "forbidden",
      message: "Cannot move a library item to wishlist",
    });

    expect(callsNamed(calls, "update")).toHaveLength(0);
  });

  it("allows wishlist→library without demotion error", async () => {
    const promoted = row("library");
    const { client, calls } = createSupabaseQueryMock({
      results: [
        { data: row("wishlist"), error: null },
        { data: promoted, error: null },
      ],
    });

    const result = await updateListType(client as unknown as SupabaseClient, ASSIGNMENT_ID, "library");

    expect(result.list_type).toBe("library");
    expect(callsNamed(calls, "update").length).toBeGreaterThan(0);
  });
});

describe("assign upsert library→wishlist demotion", () => {
  it("rejects demotion after unique conflict when existing row is library", async () => {
    const { client, calls } = createSupabaseQueryMock({
      authUser: { id: USER_ID },
      results: [
        { data: null, error: { code: "23505", message: "duplicate key" } },
        { data: row("library"), error: null },
      ],
    });

    await expect(assign(client as unknown as SupabaseClient, CATALOG_ID, "wishlist")).rejects.toMatchObject({
      name: "AssignmentServiceError",
      code: "forbidden",
      message: "Cannot move a library item to wishlist",
    });

    expect(callsNamed(calls, "update")).toHaveLength(0);
  });
});

describe("assign non-approved mapping oracle (not RLS)", () => {
  it("maps 42501 insert failure to cannot-assign-non-approved message", async () => {
    const { client } = createSupabaseQueryMock({
      authUser: { id: USER_ID },
      results: [{ data: null, error: { code: "42501", message: "permission denied" } }],
    });

    await expect(assign(client as unknown as SupabaseClient, CATALOG_ID, "wishlist")).rejects.toMatchObject({
      name: "AssignmentServiceError",
      code: "forbidden",
      message: "Cannot assign to a non-approved catalog item",
    });
  });

  it("maps policy-message insert failure to cannot-assign-non-approved message", async () => {
    const { client } = createSupabaseQueryMock({
      authUser: { id: USER_ID },
      results: [{ data: null, error: { code: "PGRST", message: "new row violates row-level security policy" } }],
    });

    await expect(assign(client as unknown as SupabaseClient, CATALOG_ID, "library")).rejects.toMatchObject({
      name: "AssignmentServiceError",
      code: "forbidden",
      message: "Cannot assign to a non-approved catalog item",
    });
  });

  it("maps 23505 with no visible existing row to cannot-assign-non-approved message", async () => {
    const { client } = createSupabaseQueryMock({
      authUser: { id: USER_ID },
      results: [
        { data: null, error: { code: "23505", message: "duplicate key" } },
        { data: null, error: null },
      ],
    });

    await expect(assign(client as unknown as SupabaseClient, CATALOG_ID, "wishlist")).rejects.toMatchObject({
      name: "AssignmentServiceError",
      code: "forbidden",
      message: "Cannot assign to a non-approved catalog item",
    });
  });
});
