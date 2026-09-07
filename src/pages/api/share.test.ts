import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => {
    throw new Error("createClient must not run when requireUser denies the request");
  }),
}));

vi.mock("@/lib/services/share", () => ({
  ShareServiceError: class ShareServiceError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "ShareServiceError";
      this.code = code;
    }
  },
  getActiveShareLink: vi.fn(),
  createOrRotateShareLink: vi.fn(),
  revokeShareLink: vi.fn(),
}));

import { DELETE, GET, POST } from "@/pages/api/share";
import { createOrRotateShareLink, getActiveShareLink, revokeShareLink } from "@/lib/services/share";
import { createClient } from "@/lib/supabase";

function unauthContext(request: Request): APIContext {
  return {
    locals: { user: null, profile: null },
    params: {},
    request,
    url: new URL(request.url),
  } as unknown as APIContext;
}

describe("share owner API requires session", () => {
  beforeEach(() => {
    vi.mocked(getActiveShareLink).mockClear();
    vi.mocked(createOrRotateShareLink).mockClear();
    vi.mocked(revokeShareLink).mockClear();
    vi.mocked(createClient).mockClear();
  });

  it("GET /api/share returns 401 without session", async () => {
    const response = await GET(unauthContext(new Request("https://example.test/api/share")));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(getActiveShareLink).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("POST /api/share returns 401 without session", async () => {
    const response = await POST(
      unauthContext(
        new Request("https://example.test/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      ),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(createOrRotateShareLink).not.toHaveBeenCalled();
  });

  it("DELETE /api/share returns 401 without session", async () => {
    const response = await DELETE(unauthContext(new Request("https://example.test/api/share", { method: "DELETE" })));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(revokeShareLink).not.toHaveBeenCalled();
  });
});
