import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listApproved } from "@/lib/services/catalog";
import { callsNamed, createSupabaseQueryMock } from "@/lib/services/__tests__/supabase-query-mock";

describe("listApproved pending-visibility filter", () => {
  it("always applies .eq(status, approved) with no search query", async () => {
    const { client, calls } = createSupabaseQueryMock();
    await listApproved(client as unknown as SupabaseClient);

    expect(callsNamed(calls, "eq")).toContainEqual({
      method: "eq",
      args: ["status", "approved"],
    });
  });

  it("keeps .eq(status, approved) when search or() is applied", async () => {
    const { client, calls } = createSupabaseQueryMock();
    await listApproved(client as unknown as SupabaseClient, "manga");

    expect(callsNamed(calls, "eq")).toContainEqual({
      method: "eq",
      args: ["status", "approved"],
    });
    expect(callsNamed(calls, "or").length).toBeGreaterThan(0);
  });
});
