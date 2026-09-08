import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import {
  lookupSubtitlesByImdb,
  lookupSubtitlesByTitle,
} from "@/lib/subtitles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 15000;
const SUBTITLE_TTL_SECONDS = 3600;
const RATE_LIMIT_PER_MIN = 30;

/**
 * GET /api/subtitles?imdb=tt0133093 | ?title=The+Matrix [&lang=English]
 * Best-match subtitles for a movie: sorted by community rating desc,
 * optional language filter. Cached 1h. No keys, no config.
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
  const imdbRaw = (url.searchParams.get("imdb") ?? "").trim();
  const title = (url.searchParams.get("title") ?? "").trim();
  const lang = (url.searchParams.get("lang") ?? "").trim().toLowerCase();
  const imdb = /^tt\d{4,}$/.test(imdbRaw) ? imdbRaw : undefined;

  if (!imdb && title.length < 2) {
    return NextResponse.json(
      { error: "bad_query", message: "provide imdb=tt... or title=..." },
      { status: 400 },
    );
  }

  const cacheKey = `sub|${imdb ?? `t:${title.toLowerCase()}`}|${lang || "all"}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  let lookup;
  try {
    lookup = imdb
      ? await lookupSubtitlesByImdb(imdb, REQUEST_TIMEOUT_MS)
      : await lookupSubtitlesByTitle(title, REQUEST_TIMEOUT_MS);
  } catch {
    return NextResponse.json(
      { error: "subtitle_unavailable", message: "subtitle provider unreachable" },
      { status: 502 },
    );
  }

  const subtitles = lang
    ? lookup.subtitles.filter((s) => s.language.toLowerCase() === lang)
    : lookup.subtitles;

  const body = {
    movieTitle: lookup.movieTitle,
    imdbId: lookup.imdbId,
    movieUrl: lookup.movieUrl,
    lang: lang || null,
    count: subtitles.length,
    subtitles: subtitles.slice(0, 100),
  };
  cacheSet(cacheKey, body, SUBTITLE_TTL_SECONDS * 1000);
  return NextResponse.json(body, { headers: { "X-Cache": "MISS" } });
}
