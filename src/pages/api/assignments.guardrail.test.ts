import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => {
    throw new Error("createClient must not run when requireUser denies the request");
  }),
}));

vi.mock("@/lib/services/assignments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/assignments")>();
  return {
    ...actual,
    assign: vi.fn(),
    updateListType: vi.fn(),
    remove: vi.fn(),
    listForUser: vi.fn(),
  };
});

import { POST as postAssignments } from "@/pages/api/assignments";
import { DELETE as deleteAssignment, PATCH as patchAssignment } from "@/pages/api/assignments/[id]";
import { assign, remove, updateListType } from "@/lib/services/assignments";
import { createClient } from "@/lib/supabase";

const ASSIGNMENT_ID = "22222222-2222-4222-8222-222222222222";
const CATALOG_ID = "33333333-3333-4333-8333-333333333333";
const SHARE_TOKEN = "PtaRAKSCWd8SpLnG29XPN0QZagpPYVyYZCKwP7BYc-s";

function unauthContext(request: Request, params: Record<string, string> = {}): APIContext {
  return {
    locals: { user: null, profile: null },
    params,
    request,
    url: new URL(request.url),
  } as unknown as APIContext;
}

describe("assignment mutate APIs reject unauthenticated requests (share token is not auth)", () => {
  beforeEach(() => {
    vi.mocked(assign).mockClear();
    vi.mocked(updateListType).mockClear();
    vi.mocked(remove).mockClear();
    vi.mocked(createClient).mockClear();
  });

  it("POST /api/assignments returns 401 without session", async () => {
    const response = await postAssignments(
      unauthContext(
        new Request("https://example.test/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalog_item_id: CATALOG_ID, list_type: "library" }),
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(assign).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("POST /api/assignments returns 401 even with share token in body/query", async () => {
    const response = await postAssignments(
      unauthContext(
        new Request(`https://example.test/api/assignments?share_token=${SHARE_TOKEN}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Share-Token": SHARE_TOKEN,
          },
          body: JSON.stringify({
            catalog_item_id: CATALOG_ID,
            list_type: "wishlist",
            share_token: SHARE_TOKEN,
          }),
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(assign).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("PATCH /api/assignments/[id] returns 401 without session (share token ignored)", async () => {
    const response = await patchAssignment(
      unauthContext(
        new Request(`https://example.test/api/assignments/${ASSIGNMENT_ID}?token=${SHARE_TOKEN}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHARE_TOKEN}` },
          body: JSON.stringify({ list_type: "library", share_token: SHARE_TOKEN }),
        }),
        { id: ASSIGNMENT_ID },
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(updateListType).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("DELETE /api/assignments/[id] returns 401 without session (share token ignored)", async () => {
    const response = await deleteAssignment(
      unauthContext(
        new Request(`https://example.test/api/assignments/${ASSIGNMENT_ID}`, {
          method: "DELETE",
          headers: { "X-Share-Token": SHARE_TOKEN },
        }),
        { id: ASSIGNMENT_ID },
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(remove).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});
