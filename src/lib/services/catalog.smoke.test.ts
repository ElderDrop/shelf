import { describe, expect, it } from "vitest";
import { CatalogServiceError } from "@/lib/services/catalog";

describe("Vitest bootstrap", () => {
  it("resolves @/ imports and loads CatalogServiceError", () => {
    expect(CatalogServiceError).toBeTypeOf("function");
  });
});
