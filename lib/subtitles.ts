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
  const html = await (await fetchWithTimeout(movieUrl, timeoutMs)).text();
  return {
    movieTitle: parseMovieTitle(html),
    imdbId,
    movieUrl,
    subtitles: parseSubtitleRows(html),
  };
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
