import { beforeEach, describe, expect, it, vi } from "vitest";
import { _clearRateLimits, checkRateLimit } from "./ratelimit";

describe("ratelimit", () => {
  beforeEach(() => _clearRateLimits());

  it("allows up to the limit then blocks with retryAfter", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("1.2.3.4", 3).allowed).toBe(true);
    }
    const blocked = checkRateLimit("1.2.3.4", 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks ips independently", () => {
    checkRateLimit("a", 1);
    expect(checkRateLimit("a", 1).allowed).toBe(false);
    expect(checkRateLimit("b", 1).allowed).toBe(true);
  });

  it("resets after the 60s window passes", () => {
    vi.useFakeTimers();
    try {
      expect(checkRateLimit("w", 2).allowed).toBe(true);
      expect(checkRateLimit("w", 2).allowed).toBe(true);
      expect(checkRateLimit("w", 2).allowed).toBe(false);
      vi.advanceTimersByTime(61_000);
      expect(checkRateLimit("w", 2).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
