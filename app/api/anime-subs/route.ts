import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import { lookupAnimeSubs } from "@/lib/kitsu";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 15000;
const KITSU_TTL_SECONDS = 86400;
const RATE_LIMIT_PER_MIN = 30;

/**
 * GET /api/anime-subs?title=<nyaa release title>
 * Japanese subtitles from kitsunekko.net matched to the anime + episode.
 * Cached 24h (folder listings barely change). No keys, no config.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const headers = new Headers(req.headers);
  const rl = checkRateLimit(getClientIp(headers), RATE_LIMIT_PER_MIN);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const url = new URL(req.url);
  const title = (url.searchParams.get("title") ?? "").trim();
  if (title.length < 2) {
    return NextResponse.json(
      { error: "bad_query", message: "title must be 2+ characters" },
      { status: 400 },
    );
  }

  const cacheKey = `kitsu|${title.toLowerCase()}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  try {
    const body = await lookupAnimeSubs(title, REQUEST_TIMEOUT_MS);
    cacheSet(cacheKey, body, KITSU_TTL_SECONDS * 1000);
    return NextResponse.json(body, { headers: { "X-Cache": "MISS" } });
  } catch {
    return NextResponse.json(
      { error: "subtitle_unavailable", message: "subtitle provider unreachable" },
      { status: 502 },
    );
  }
}
