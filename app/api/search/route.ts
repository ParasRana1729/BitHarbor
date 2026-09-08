import { NextResponse } from "next/server";
import { buildCacheKey, cacheGet, cacheSet } from "@/lib/cache";
import { isCategoryId, type CategoryId } from "@/lib/categories";
import { searchProviders } from "@/lib/providers";
import { rankResults } from "@/lib/rank";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { resolveSources } from "@/lib/sources";
import type { SearchResponse, TorrentResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby kills functions at 10s by default; the 5-provider fan-out
// (incl. the sequential TVMaze->EZTV chain) needs headroom. Max on Hobby: 60.
export const maxDuration = 60;

// Everything works out of the box — no env files, no keys, no setup.
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_TTL_SECONDS = 300;
const RATE_LIMIT_PER_MIN = 30;
const HIDE_ZERO_SEED = true;
const MAX_RESULTS = 100;

function parseList(raw: string | null): string[] {
  if (!raw || !raw.trim()) return [];
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

/**
 * GET /api/search?q=<query>&cat=<movies|tv|anime|music|books|software|games|all>&trackers=<nyaa,yts,tpb|all>&includeZero=1
 * Merges zero-config providers (Nyaa RSS, YTS API, TPB/Apibay) filtered by
 * category. Ranked: 0-seed hidden by default, seeders desc.
 * Errors: 400 bad query / bad category / bad tracker, 429 rate limited.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const started = Date.now();
  const headers = new Headers(req.headers);
  const ip = getClientIp(headers);

  const rl = checkRateLimit(ip, RATE_LIMIT_PER_MIN);
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

  const catRaw = (url.searchParams.get("cat") ?? "all").trim().toLowerCase();
  if (!isCategoryId(catRaw)) {
    return NextResponse.json(
      { error: "bad_category", message: "unknown category" },
      { status: 400 },
    );
  }
  const category: CategoryId = catRaw;

  const { providers, effectiveTrackers, invalid } = resolveSources(
    parseList(url.searchParams.get("trackers")),
    category,
  );
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "bad_tracker", message: `unknown tracker: ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  const includeZero =
    url.searchParams.get("includeZero") === "1" ||
    url.searchParams.get("includeZero")?.toLowerCase() === "true";

  const cacheKey = buildCacheKey(
    `${category}|${q}`,
    includeZero ? [...effectiveTrackers, "inc0"] : effectiveTrackers,
  );
  const cachedResults = cacheGet<TorrentResult[]>(cacheKey);
  if (cachedResults) {
    const body: SearchResponse = {
      query: q,
      category,
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

  const results = await searchProviders(q, providers, REQUEST_TIMEOUT_MS, category);

  const sliced = rankResults(results, {
    hideZeroSeed: includeZero ? false : HIDE_ZERO_SEED,
    maxResults: MAX_RESULTS,
  });

  cacheSet(cacheKey, sliced, CACHE_TTL_SECONDS * 1000);

  // Deliberately no query-content logging: only counts + timings.
  if (process.env.NODE_ENV !== "test") {
    console.log(
      JSON.stringify({
        msg: "search",
        category,
        trackers: effectiveTrackers.length,
        count: sliced.length,
        tookMs: Date.now() - started,
        cached: false,
      }),
    );
  }

  const body: SearchResponse = {
    query: q,
    category,
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
