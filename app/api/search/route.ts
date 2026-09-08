import { NextResponse } from "next/server";
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/cache";
import { getConfig, isJackettConfigured } from "@/lib/indexers";
import { searchBuiltin } from "@/lib/providers";
import { rankResults } from "@/lib/rank";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { resolveSources } from "@/lib/sources";
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
 * Sources: built-in providers (nyaa, yts — no config needed) merged with
 * Jackett/Torznab when TORZNAB_URL + TORZNAB_API_KEY are set.
 * Response: SearchResponse — results ranked (seeders desc), 0-seed hidden by default.
 * Errors: 400 bad query, 429 rate limited, 503 jackett needed but not configured.
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

  const trackers = parseTrackers(
    url.searchParams.get("trackers"),
    cfg.defaultIndexers,
  );
  const includeZero =
    url.searchParams.get("includeZero") === "1" ||
    url.searchParams.get("includeZero")?.toLowerCase() === "true";

  // Source routing (built-in nyaa/yts vs Jackett) — see lib/sources.ts.
  const { builtinIds, jackettQuery, effectiveTrackers, needsJackettError } =
    resolveSources({
      trackers,
      defaultIndexers: cfg.defaultIndexers,
      jackettConfigured: isJackettConfigured(cfg),
      explicitTrackers: url.searchParams.has("trackers"),
    });
  if (needsJackettError) {
    return NextResponse.json(
      {
        error: "jackett_not_configured",
        message:
          "This tracker needs Jackett. Set TORZNAB_URL and TORZNAB_API_KEY, or search nyaa / yts which need no config. See .env.example.",
      },
      { status: 503 },
    );
  }

  const cacheKey = buildCacheKey(
    q,
    includeZero ? [...effectiveTrackers, "inc0"] : effectiveTrackers,
  );
  const cachedResults = cacheGet<TorrentResult[]>(cacheKey);
  if (cachedResults) {
    const body: SearchResponse = {
      query: q,
      trackers: effectiveTrackers,
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

  const [builtinResults, torznabResults] = await Promise.all([
    builtinIds.length > 0
      ? searchBuiltin(q, builtinIds, cfg.requestTimeoutMs)
      : Promise.resolve([] as TorrentResult[]),
    jackettQuery
      ? searchTorznabAll(q, jackettQuery).then((r) => r.results)
      : Promise.resolve([] as TorrentResult[]),
  ]);

  const sliced = rankResults([...builtinResults, ...torznabResults], {
    hideZeroSeed: includeZero ? false : cfg.hideZeroSeed,
    maxResults: cfg.maxResults,
  });

  cacheSet(cacheKey, sliced, cfg.cacheTtlSeconds * 1000);

  // Deliberately no query-content logging: only counts + timings.
  if (process.env.NODE_ENV !== "test") {
    console.log(
      JSON.stringify({
        msg: "search",
        trackers: effectiveTrackers.length,
        count: sliced.length,
        tookMs: Date.now() - started,
        cached: false,
      }),
    );
  }

  const body: SearchResponse = {
    query: q,
    trackers: effectiveTrackers,
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
