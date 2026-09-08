import { describe, expect, it } from "vitest";
import { providersForCategory, resolveSources } from "./sources";

describe("providersForCategory", () => {
  it("movies get nyaa/yts/tpb/solid, tv adds eztv", () => {
    expect(providersForCategory("movies")).toEqual(["nyaa", "yts", "tpb", "solid"]);
    expect(providersForCategory("tv")).toEqual(["nyaa", "tpb", "solid", "eztv"]);
    expect(providersForCategory("anime")).toEqual(["nyaa", "solid"]);
  });
});

describe("resolveSources", () => {
  it("blank/all => every provider the category uses", () => {
    expect(resolveSources([], "movies")).toEqual({
      providers: ["nyaa", "yts", "tpb", "solid"],
      effectiveTrackers: ["nyaa", "yts", "tpb", "solid"],
      invalid: [],
    });
    expect(resolveSources(["all"], "anime")).toEqual({
      providers: ["nyaa", "solid"],
      effectiveTrackers: ["nyaa", "solid"],
      invalid: [],
    });
  });

  it("explicit ids => exactly those", () => {
    expect(resolveSources(["tpb"], "all").providers).toEqual(["tpb"]);
    expect(resolveSources(["yts", "nyaa"], "all").providers).toEqual([
      "yts",
      "nyaa",
    ]);
  });

  it("flags unknown ids without dropping the valid ones", () => {
    const r = resolveSources(["nyaa", "1337x"], "all");
    expect(r.providers).toEqual(["nyaa"]);
    expect(r.invalid).toEqual(["1337x"]);
  });

  it("dedupes and lowercases", () => {
    const r = resolveSources(["TPB", "tpb", "YTS"], "all");
    expect(r.providers).toEqual(["tpb", "yts"]);
  });
});
