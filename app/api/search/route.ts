import { NextResponse } from "next/server";
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/cache";
import { getConfig, isJackettConfigured } from "@/lib/indexers";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { searchTorznabAll } from "@/lib/torznab";
import type { SearchResponse, TorrentResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTrackers(raw: string | null, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return fallback;
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parts.length > 0 ? Array.from(new Set(parts)) : fallback;
}

/**
 * GET /api/search?q=<query>&trackers=<csv>&includeZero=1
 * Response: SearchResponse — results sorted seeders desc, 0-seed hidden by default.
 * Errors: 400 bad query, 429 rate limited, 503 jackett not configured.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const started = Date.now();
  const cfg = getConfig();
  const headers = new Headers(req.headers);
  const ip = getClientIp(headers);

  const rl = checkRateLimit(ip, cfg.rateLimitPerMin);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 100) {
    return NextResponse.json(
      { error: "bad_query", message: "q must be 2..100 characters" },
      { status: 400 },
    );
  }

  if (!isJackettConfigured(cfg)) {
    return NextResponse.json(
      {
        error: "jackett_not_configured",
        message: "Set TORZNAB_URL and TORZNAB_API_KEY. See .env.example.",
      },
      { status: 503 },
    );
  }

  const trackers = parseTrackers(url.searchParams.get("trackers"), cfg.defaultIndexers);
  const includeZero =
    url.searchParams.get("includeZero") === "1" ||
    url.searchParams.get("includeZero")?.toLowerCase() === "true";

  const cacheKey = buildCacheKey(q, includeZero ? [...trackers, "inc0"] : trackers);
  const cachedResults = cacheGet<TorrentResult[]>(cacheKey);
  if (cachedResults) {
    const body: SearchResponse = {
      query: q,
      trackers,
      cached: true,
      tookMs: Date.now() - started,
      count: cachedResults.length,
      results: cachedResults,
    };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-Cache": "HIT",
      },
    });
  }

  const { results } = await searchTorznabAll(q, trackers);

  // Trust rule (grilled spec): hide 0-seed by default, sort seeders desc,
  // trusted uploaders float within equal seeder counts — never hide trusted.
  const filtered = results.filter((r) => {
    if (r.trusted) return true;
    if (!includeZero && cfg.hideZeroSeed && r.seeders <= 0) return false;
    return true;
  });
  filtered.sort((a, b) => {
    if (b.seeders !== a.seeders) return b.seeders - a.seeders;
    if (a.trusted !== b.trusted) return a.trusted ? -1 : 1;
    return b.leechers - a.leechers;
  });
  const sliced = filtered.slice(0, cfg.maxResults);

  cacheSet(cacheKey, sliced, cfg.cacheTtlSeconds * 1000);

  // Deliberately no query-content logging: only counts + timings.
  if (process.env.NODE_ENV !== "test") {
    console.log(
      JSON.stringify({
        msg: "search",
        trackers: trackers.length,
        count: sliced.length,
        tookMs: Date.now() - started,
        cached: false,
      }),
    );
  }

  const body: SearchResponse = {
    query: q,
    trackers,
    cached: false,
    tookMs: Date.now() - started,
    count: sliced.length,
    results: sliced,
  };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "X-Cache": "MISS",
    },
  });
}
