import { describe, expect, it } from "vitest";
import { categorySources, isCategoryId } from "./categories";

describe("isCategoryId", () => {
  it("accepts known categories, rejects the rest", () => {
    for (const c of ["all", "movies", "tv", "anime", "music", "books", "software", "games"]) {
      expect(isCategoryId(c)).toBe(true);
    }
    expect(isCategoryId("1337x")).toBe(false);
    expect(isCategoryId("")).toBe(false);
  });
});

describe("categorySources", () => {
  it("gives movies the full treatment (nyaa + yts + tpb movie cats)", () => {
    expect(categorySources("movies")).toEqual({ nyaa: "4_0", yts: true, tpb: [201, 207] });
  });

  it("keeps anime nyaa-only", () => {
    const s = categorySources("anime");
    expect(s.nyaa).toBe("1_0");
    expect(s.yts).toBe(false);
    expect(s.tpb).toEqual([]);
  });

  it("maps books/software/games to the right feed filters", () => {
    expect(categorySources("books")).toMatchObject({ nyaa: "3_0", tpb: [601] });
    expect(categorySources("software")).toMatchObject({ nyaa: "6_1", tpb: [301] });
    expect(categorySources("games")).toMatchObject({ nyaa: "6_2", tpb: [401] });
  });

  it("leaves all unfiltered", () => {
    expect(categorySources("all")).toEqual({ nyaa: "0_0", yts: true, tpb: [] });
  });
});
