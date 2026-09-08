import { fetchWithTimeout, normalizeImdbId, YTS_API_URL } from "./providers";

/**
 * Subtitle lookup via YIFY Subtitles (no key needed).
 * Flow: movie page (/movie-imdb/tt...) lists one row per subtitle;
 * each row links to a detail page whose slug doubles as the zip URL:
 * /subtitles/<slug>  ->  /subtitle/<slug>.zip
 * Title search (/search?q=) resolves to the first matching movie page.
 */

const YIFY_BASE = "https://yifysubtitles.ch";

export interface SubtitleEntry {
  id: string;
  language: string;
  rating: number;
  uploader?: string;
  release?: string;
  pageUrl: string;
  downloadUrl: string;
}

export interface SubtitleLookup {
  movieTitle: string;
  imdbId?: string;
  movieUrl: string;
  subtitles: SubtitleEntry[];
}

function matchFirst(html: string, re: RegExp): string | undefined {
  const m = re.exec(html);
  return m?.[1];
}

/** Pure: movie page HTML -> subtitle rows, rating desc. Exported for tests. */
export function parseSubtitleRows(html: string): SubtitleEntry[] {
  const out: SubtitleEntry[] = [];
  const rowRe = /<tr\s+data-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const [, rowId, body] = row;
    const slug = matchFirst(body, /href="(\/subtitles\/[^"]+)"/);
    const language = matchFirst(body, /sub-lang">([^<]+)</)?.trim();
    if (!slug || !language) continue;
    const ratingRaw = matchFirst(
      body,
      /rating-cell[^>]*>[\s\S]*?<span[^>]*>(-?\d+)<\/span>/,
    );
    const uploader = matchFirst(
      body,
      /uploader-cell[^>]*>[\s\S]*?<a[^>]*>([^<]+)</,
    )?.trim();
    const release = matchFirst(
      body,
      /\/subtitles\/[^"]+">(?:<span[^>]*>[^<]*<\/span>\s*)?([^<]+)</,
    )?.trim();
    out.push({
      id: rowId,
      language,
      rating: ratingRaw ? Number.parseInt(ratingRaw, 10) : 0,
      uploader: uploader || undefined,
      release: release || undefined,
      pageUrl: `${YIFY_BASE}${slug}`,
      downloadUrl: `${YIFY_BASE}/subtitle${slug.slice("/subtitles".length)}.zip`,
    });
  }
  out.sort((a, b) => b.rating - a.rating);
  return out;
}

/** Pure: movie page HTML -> <title>. Exported for tests. */
export function parseMovieTitle(html: string): string {
  const raw = matchFirst(html, /<title>([^<]*)<\/title>/)?.trim() ?? "Unknown title";
  return raw.replace(/\s+YIFY subtitles\s*$/i, "").trim() || raw;
}

/** "Show S01E02 720p" -> "S01E02" (normalized, uppercased). */
export function extractSeasonEpisode(title: string): string | undefined {
  const m = title.match(/S(\d{1,2})E(\d{1,3})/i);
  if (!m) return undefined;
  return `S${m[1].padStart(2, "0")}E${m[2].padStart(2, "0")}`.toUpperCase();
}

/**
 * Keep only rows whose release tag names the episode (e.g. S01E02).
 * Returns the original list when nothing matches so callers can
 * signal episodeFiltered=false instead of showing an empty list.
 */
export function filterByEpisode(
  subs: SubtitleEntry[],
  ep: string,
): { filtered: SubtitleEntry[]; applied: boolean } {
  const nums = ep.match(/S(\d+)E(\d+)/i);
  const patterns = nums
    ? [
        ep.toUpperCase(),
        `S${Number(nums[1])}E${Number(nums[2])}`,
        `${Number(nums[1])}x${Number(nums[2])}`,
      ]
    : [ep];
  const hits = subs.filter((s) =>
    patterns.some((p) => (s.release ?? "").toUpperCase().includes(p.toUpperCase())),
  );
  return hits.length > 0 ? { filtered: hits, applied: true } : { filtered: subs, applied: false };
}

/** Pure: YTS search JSON -> first movie imdb id. Exported for tests. */
export function firstImdbFromYts(json: unknown): string | undefined {
  const movies = (json as { data?: { movies?: { imdb_code?: string }[] } })?.data
    ?.movies;
  if (!Array.isArray(movies)) return undefined;
  for (const m of movies) {
    const id = normalizeImdbId(m.imdb_code);
    if (id) return id;
  }
  return undefined;
}

export async function lookupSubtitlesByImdb(
  imdbId: string,
  timeoutMs: number,
): Promise<SubtitleLookup> {
  const movieUrl = `${YIFY_BASE}/movie-imdb/${imdbId}`;
  try {
    const html = await (await fetchWithTimeout(movieUrl, timeoutMs)).text();
    return {
      movieTitle: parseMovieTitle(html),
      imdbId,
      movieUrl,
      subtitles: parseSubtitleRows(html),
    };
  } catch (err) {
    // no page for this title (common for series) => empty, not an error
    if (err instanceof Error && err.message.includes("404")) {
      return { movieTitle: imdbId, imdbId, movieUrl, subtitles: [] };
    }
    throw err;
  }
}

export async function lookupSubtitlesByTitle(
  title: string,
  timeoutMs: number,
): Promise<SubtitleLookup> {
  // yifysubtitles search is JS-rendered; resolve titles via the YTS JSON API.
  try {
    const ytsUrl = `${YTS_API_URL}?query_term=${encodeURIComponent(title)}&limit=3`;
    const json = await (await fetchWithTimeout(ytsUrl, timeoutMs)).json();
    const imdbId = firstImdbFromYts(json);
    if (imdbId) return lookupSubtitlesByImdb(imdbId, timeoutMs);
  } catch {
    // fall through to the empty result below
  }
  return { movieTitle: title, movieUrl: YTS_API_URL, subtitles: [] };
}
