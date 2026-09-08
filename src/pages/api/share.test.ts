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

const USER = { id: "00000000-0000-4000-8000-000000000099", email: "user@example.com" };

function unauthContext(request: Request): APIContext {
  return {
    locals: { user: null, profile: null },
    params: {},
    request,
    url: new URL(request.url),
    cookies: {},
  } as unknown as APIContext;
}

function authContext(request: Request): APIContext {
  return {
    locals: { user: USER, profile: { id: USER.id, role: "user" } },
    params: {},
    request,
    url: new URL(request.url),
    cookies: {},
  } as unknown as APIContext;
}

describe("share owner API requires session", () => {
  beforeEach(() => {
    vi.mocked(getActiveShareLink).mockClear();
    vi.mocked(createOrRotateShareLink).mockClear();
    vi.mocked(revokeShareLink).mockClear();
    vi.mocked(createClient).mockClear();
    vi.mocked(createClient).mockImplementation(() => {
      throw new Error("createClient must not run when requireUser denies the request");
    });
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

describe("GET /api/share status shapes", () => {
  beforeEach(() => {
    vi.mocked(getActiveShareLink).mockReset();
    vi.mocked(createClient).mockReset();
    vi.mocked(createClient).mockReturnValue({} as ReturnType<typeof createClient>);
  });

  it("returns url when stored token is present", async () => {
    vi.mocked(getActiveShareLink).mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      user_id: USER.id,
      created_at: "2026-09-07T00:00:00.000Z",
      token: "raw-token-abc",
    });

    const response = await GET(authContext(new Request("https://example.test/api/share")));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        active: true,
        created_at: "2026-09-07T00:00:00.000Z",
        url: "https://example.test/share/raw-token-abc",
      },
    });
  });

  it("omits url for legacy active rows without token", async () => {
    vi.mocked(getActiveShareLink).mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      user_id: USER.id,
      created_at: "2026-09-07T00:00:00.000Z",
      token: null,
    });

    const response = await GET(authContext(new Request("https://example.test/api/share")));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        active: true,
        created_at: "2026-09-07T00:00:00.000Z",
      },
    });
  });

  it("returns active false when no row", async () => {
    vi.mocked(getActiveShareLink).mockResolvedValue(null);

    const response = await GET(authContext(new Request("https://example.test/api/share")));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { active: false } });
  });
});
