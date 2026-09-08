import { describe, expect, it } from "vitest";
import { resolveSources } from "./sources";

describe("resolveSources", () => {
  it("default + unconfigured => builtins only, no error", () => {
    const r = resolveSources({
      trackers: ["all"],
      defaultIndexers: ["all"],
      jackettConfigured: false,
      explicitTrackers: false,
    });
    expect(r.needsJackettError).toBe(false);
    expect(r.builtinIds).toEqual(["nyaa", "yts"]);
    expect(r.jackettQuery).toBeNull();
    expect(r.effectiveTrackers).toEqual(["nyaa", "yts"]);
  });

  it("explicit jackett id + unconfigured => 503 signal", () => {
    const r = resolveSources({
      trackers: ["1337x"],
      defaultIndexers: ["all"],
      jackettConfigured: false,
      explicitTrackers: true,
    });
    expect(r.needsJackettError).toBe(true);
  });

  it("explicit builtin ids + unconfigured => builtins only", () => {
    const r = resolveSources({
      trackers: ["nyaa"],
      defaultIndexers: ["all"],
      jackettConfigured: false,
      explicitTrackers: true,
    });
    expect(r.needsJackettError).toBe(false);
    expect(r.builtinIds).toEqual(["nyaa"]);
    expect(r.jackettQuery).toBeNull();
  });

  it("configured + all => jackett all feed plus builtins", () => {
    const r = resolveSources({
      trackers: ["all"],
      defaultIndexers: ["all"],
      jackettConfigured: true,
      explicitTrackers: false,
    });
    expect(r.jackettQuery).toEqual(["all"]);
    expect(r.effectiveTrackers).toEqual(["nyaa", "yts", "all"]);
  });

  it("configured + mixed ids => splits builtin vs jackett", () => {
    const r = resolveSources({
      trackers: ["yts", "1337x"],
      defaultIndexers: ["all"],
      jackettConfigured: true,
      explicitTrackers: true,
    });
    expect(r.builtinIds).toEqual(["yts"]);
    expect(r.jackettQuery).toEqual(["1337x"]);
  });
});
