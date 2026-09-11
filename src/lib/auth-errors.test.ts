import { describe, expect, it } from "vitest";
import { resolveAuthErrorMessage } from "@/lib/auth-errors";

describe("resolveAuthErrorMessage", () => {
  it("maps allowlisted codes to fixed copy", () => {
    expect(resolveAuthErrorMessage("not_configured")).toBe("Supabase is not configured");
    expect(resolveAuthErrorMessage("signin_failed")).toBe("Invalid email or password.");
    expect(resolveAuthErrorMessage("signup_failed")).toBe(
      "Could not create your account. Please try again.",
    );
  });

  it("drops unknown or free-text query values", () => {
    expect(resolveAuthErrorMessage("Please wire funds to attacker")).toBeNull();
    expect(resolveAuthErrorMessage("Invalid login credentials")).toBeNull();
    expect(resolveAuthErrorMessage("")).toBeNull();
    expect(resolveAuthErrorMessage(null)).toBeNull();
  });
});
