import { beforeEach, describe, expect, it } from "vitest";
import { _clearCache, buildCacheKey, cacheGet, cacheSet } from "./cache";

describe("cache", () => {
  beforeEach(() => _clearCache());

  it("round-trips values", () => {
    cacheSet("k", [1, 2], 60_000);
    expect(cacheGet("k")).toEqual([1, 2]);
  });

  it("expires entries", async () => {
    cacheSet("k", "v", 10);
    await new Promise((r) => setTimeout(r, 25));
    expect(cacheGet("k")).toBeNull();
  });

  it("normalizes keys (case/space/tracker order)", () => {
    expect(buildCacheKey("  Ubuntu  ISO ", ["yts", "nyaa"])).toBe(
      buildCacheKey("ubuntu iso", ["nyaa", "yts"]),
    );
  });

  it("evicts oldest beyond the 200-entry bound (memory safety at scale)", () => {
    for (let i = 0; i < 210; i++) cacheSet(`k${i}`, i, 60_000);
    expect(cacheGet("k0")).toBeNull();
    expect(cacheGet("k9")).toBeNull();
    expect(cacheGet("k209")).toBe(209);
  });
});
