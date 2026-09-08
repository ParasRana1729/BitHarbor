import { describe, expect, it } from "vitest";
import { rankResults } from "./rank";
import type { TorrentResult } from "./types";

function row(partial: Partial<TorrentResult> & { title: string }): TorrentResult {
  return {
    id: partial.title,
    tracker: "t",
    seeders: 0,
    leechers: 0,
    sizeBytes: 0,
    publishedAt: new Date(0).toISOString(),
    trusted: false,
    ...partial,
  };
}

describe("rankResults", () => {
  it("sorts seeders desc, trusted breaks ties, then leechers", () => {
    const out = rankResults(
      [
        row({ title: "b", seeders: 10, leechers: 1 }),
        row({ title: "a", seeders: 50 }),
        row({ title: "c", seeders: 10, trusted: true }),
        row({ title: "d", seeders: 10, leechers: 9 }),
      ],
      { hideZeroSeed: true, maxResults: 100 },
    );
    expect(out.map((r) => r.title)).toEqual(["a", "c", "d", "b"]);
  });

  it("hides 0-seed by default but never hides trusted", () => {
    const out = rankResults(
      [
        row({ title: "zero", seeders: 0 }),
        row({ title: "trusted-zero", seeders: 0, trusted: true }),
        row({ title: "one", seeders: 1 }),
      ],
      { hideZeroSeed: true, maxResults: 100 },
    );
    expect(out.map((r) => r.title)).toEqual(["one", "trusted-zero"]);
  });

  it("includeZero path keeps everything", () => {
    const out = rankResults([row({ title: "zero", seeders: 0 })], {
      hideZeroSeed: false,
      maxResults: 100,
    });
    expect(out).toHaveLength(1);
  });

  it("caps at maxResults", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({ title: `t${i}`, seeders: i }),
    );
    const out = rankResults(rows, { hideZeroSeed: true, maxResults: 3 });
    expect(out).toHaveLength(3);
    expect(out[0].title).toBe("t9");
  });
});
