import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import type { Profile } from "@/types";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => {
    throw new Error("createClient must not run when requireAdmin denies the request");
  }),
}));

vi.mock("@/lib/services/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/catalog")>();
  return {
    ...actual,
    update: vi.fn(actual.update),
  };
});

import { PATCH } from "@/pages/api/admin/catalog/[id]";
import { update } from "@/lib/services/catalog";

const CATALOG_ID = "11111111-1111-4111-8111-111111111111";

function profile(role: Profile["role"]): Profile {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    role,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function patchContext(opts: { profile: Profile | null; status: "approved" | "rejected" }): APIContext {
  return {
    locals: { profile: opts.profile, user: null },
    params: { id: CATALOG_ID },
    request: new Request(`https://example.test/api/admin/catalog/${CATALOG_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: opts.status }),
    }),
  } as unknown as APIContext;
}

describe("admin catalog PATCH cannot-approve mutation denial", () => {
  beforeEach(() => {
    vi.mocked(update).mockClear();
  });

  it("returns 403 Forbidden JSON for non-admin approve and does not call update", async () => {
    const response = await PATCH(patchContext({ profile: profile("user"), status: "approved" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 403 Forbidden JSON for non-admin reject and does not call update", async () => {
    const response = await PATCH(patchContext({ profile: profile("user"), status: "rejected" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 403 when profile is null on approve and does not call update", async () => {
    const response = await PATCH(patchContext({ profile: null, status: "approved" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(update).not.toHaveBeenCalled();
  });
});
