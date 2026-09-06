import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ShareServiceError,
  createOrRotateShareLink,
  generateShareToken,
  getActiveShareLink,
  hashShareToken,
  resolveShareByToken,
  revokeShareLink,
} from "@/lib/services/share";
import { callsNamed, createSupabaseQueryMock } from "@/lib/services/__tests__/supabase-query-mock";

const USER_ID = "00000000-0000-4000-8000-000000000099";
const SHARE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

vi.mock("@/lib/supabase-service", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase-service";

const mockedCreateServiceClient = vi.mocked(createServiceClient);

beforeEach(() => {
  mockedCreateServiceClient.mockReset();
});

describe("hashShareToken / generateShareToken", () => {
  it("hashes deterministically and generates opaque tokens", async () => {
    const a = await hashShareToken("test-token");
    const b = await hashShareToken("test-token");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);

    const token = generateShareToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("getActiveShareLink", () => {
  it("returns null when no row", async () => {
    const { client } = createSupabaseQueryMock({
      authUser: { id: USER_ID },
      results: [{ data: null, error: null }],
    });
    await expect(getActiveShareLink(client as unknown as SupabaseClient)).resolves.toBeNull();
  });

  it("returns share metadata without exposing hash as token", async () => {
    const { client } = createSupabaseQueryMock({
      authUser: { id: USER_ID },
      results: [
        {
          data: {
            id: SHARE_ID,
            user_id: USER_ID,
            token_hash: "abc",
            created_at: "2026-09-06T00:00:00.000Z",
          },
          error: null,
        },
      ],
    });
    const link = await getActiveShareLink(client as unknown as SupabaseClient);
    expect(link).toEqual({
      id: SHARE_ID,
      user_id: USER_ID,
      created_at: "2026-09-06T00:00:00.000Z",
    });
  });
});

describe("createOrRotateShareLink", () => {
  it("creates when no prior row (created: true)", async () => {
    const { client, calls } = createSupabaseQueryMock({
      authUser: { id: USER_ID },
      results: [
        { data: null, error: null },
        {
          data: {
            id: SHARE_ID,
            user_id: USER_ID,
            token_hash: "deadbeef",
            created_at: "2026-09-06T00:00:00.000Z",
          },
          error: null,
        },
      ],
    });

    const result = await createOrRotateShareLink(client as unknown as SupabaseClient);
    expect(result.created).toBe(true);
    expect(result.rawToken.length).toBeGreaterThan(16);
    expect(callsNamed(calls, "delete")).toHaveLength(0);
    expect(callsNamed(calls, "insert").length).toBeGreaterThan(0);
  });

  it("rotates when prior row exists (created: false)", async () => {
    const { client, calls } = createSupabaseQueryMock({
      authUser: { id: USER_ID },
      results: [
        { data: { id: SHARE_ID }, error: null },
        { data: null, error: null },
        {
          data: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            user_id: USER_ID,
            token_hash: "cafebabe",
            created_at: "2026-09-06T01:00:00.000Z",
          },
          error: null,
        },
      ],
    });

    const result = await createOrRotateShareLink(client as unknown as SupabaseClient);
    expect(result.created).toBe(false);
    expect(callsNamed(calls, "delete").length).toBeGreaterThan(0);
    expect(callsNamed(calls, "insert").length).toBeGreaterThan(0);
  });
});

describe("revokeShareLink", () => {
  it("deletes by user_id", async () => {
    const { client, calls } = createSupabaseQueryMock({
      authUser: { id: USER_ID },
      results: [{ data: null, error: null }],
    });
    await revokeShareLink(client as unknown as SupabaseClient);
    expect(callsNamed(calls, "delete").length).toBeGreaterThan(0);
  });
});

describe("resolveShareByToken", () => {
  it("throws misconfigured when service client missing", async () => {
    mockedCreateServiceClient.mockReturnValue(null);
    await expect(resolveShareByToken("some-token-value-xx")).rejects.toMatchObject({
      name: "ShareServiceError",
      code: "misconfigured",
    });
  });

  it("throws not_found when token hash misses", async () => {
    const { client } = createSupabaseQueryMock({
      results: [{ data: null, error: null }],
    });
    mockedCreateServiceClient.mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>);

    await expect(resolveShareByToken("missing-token-xxxxx")).rejects.toMatchObject({
      name: "ShareServiceError",
      code: "not_found",
    });
  });

  it("returns library and wishlist for approved embeds only", async () => {
    const { client, calls } = createSupabaseQueryMock({
      results: [
        {
          data: {
            id: SHARE_ID,
            user_id: USER_ID,
            token_hash: "x",
            created_at: "2026-09-06T00:00:00.000Z",
          },
          error: null,
        },
        {
          data: [
            {
              list_type: "library",
              catalog_items: { title: "Lib Book", description: "d", tags: ["t"], status: "approved" },
            },
            {
              list_type: "wishlist",
              catalog_items: { title: "Wish Book", description: null, tags: [], status: "approved" },
            },
          ],
          error: null,
        },
      ],
    });
    mockedCreateServiceClient.mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>);

    const resolved = await resolveShareByToken("valid-token-xxxxxxx");
    expect(resolved.library).toHaveLength(1);
    expect(resolved.library[0]?.catalog_item.title).toBe("Lib Book");
    expect(resolved.wishlist).toHaveLength(1);
    expect(resolved.wishlist[0]?.catalog_item.title).toBe("Wish Book");

    const eqs = callsNamed(calls, "eq");
    expect(eqs.some((c) => c.args[0] === "user_id" && c.args[1] === USER_ID)).toBe(true);
    expect(eqs.some((c) => c.args[0] === "catalog_items.status" && c.args[1] === "approved")).toBe(true);
  });
});

describe("ShareServiceError", () => {
  it("is constructible", () => {
    const err = new ShareServiceError("not_found", "gone");
    expect(err.code).toBe("not_found");
  });
});
