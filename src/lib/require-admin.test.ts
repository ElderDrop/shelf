import { describe, expect, it } from "vitest";
import { requireAdmin } from "@/lib/require-admin";
import type { Profile } from "@/types";

function profile(role: Profile["role"]): Profile {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    role,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("requireAdmin pending-visibility admin gate", () => {
  it("returns 403 Forbidden JSON for a non-admin profile", async () => {
    const response = requireAdmin({ locals: { profile: profile("user") } });
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("expected Response");
    }
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("returns 403 when profile is null", async () => {
    const response = requireAdmin({ locals: { profile: null } });
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("expected Response");
    }
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("returns null for an admin profile", () => {
    expect(requireAdmin({ locals: { profile: profile("admin") } })).toBeNull();
  });
});
