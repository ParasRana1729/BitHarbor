import { fetchWithTimeout } from "./providers";

/**
 * Anime subtitle lookup via kitsunekko.net (Japanese subs, no key).
 * Flow: cached section index -> best-matching anime folder -> subtitle files.
 * Nyaa titles like "[SubsPlease] One Piece - 1177 (1080p)" are normalized
 * to a folder name; episode digits filter to the matching episode's files.
 */

const KITSU_BASE = "https://kitsunekko.net";
const KITSU_INDEX_URL = `${KITSU_BASE}/dirlist.php?dir=subtitles%2Fjapanese`;

export interface KitsuSub {
  name: string;
  url: string;
}

export interface KitsuLookup {
  anime: string;
  folderUrl: string;
  episode?: string;
  episodeFiltered: boolean;
  count: number;
  subtitles: KitsuSub[];
}

/** "[SubsPlease] One Piece - 1177 (1080p) [ABCD].mkv" -> "One Piece" */
export function normalizeAnimeTitle(raw: string): string {
  let s = raw
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\.(mkv|mp4|avi)$/i, " ");
  // drop " - 1177" style episode tails and SxxExx / EPnnn markers + rest
  s = s.split(/\s-\s/)[0] ?? s;
  s = s
    .replace(/\b(S\d{1,2}E\d{1,3}|EP?\d{1,4}v?\d?)\b.*$/i, " ")
    .replace(
      /\b(1080p|720p|480p|2160p|4k|web-?dl|webrip|bluray|bdr?ip|hdtv|h264|h265|hevc|x264|x265|aac|ac3|flac|dual|multi|uncensored)\b.*$/gi,
      " ",
    );
  return foldName(s);
}

export function foldName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "…One Piece - 1177…" -> "1177" (2-4 digits near the end). */
export function extractEpisodeNumber(raw: string): string | undefined {
  const m = raw.match(/(?:^|[\s\-_.\[])(?:S\d{1,2}E|E(?:P)?)?(\d{2,4})(?:v\d)?(?:[\s\-_.\])]|$)/i);
  return m ? m[1] : undefined;
}

/** Pure: section index HTML -> decoded anime folder names. */
export function parseIndexFolders(html: string): string[] {
  const out: string[] = [];
  const re = /dir=subtitles%2Fjapanese%2F([^&"']+?)(?:&|"|'|>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const name = decodeURIComponent(m[1]).replace(/\/$/, "");
      if (name && !out.includes(name)) out.push(name);
    } catch {
      // skip malformed escapes
    }
  }
  return out;
}

/** Pure: pick best folder for a normalized candidate. */
export function findBestFolder(
  folders: string[],
  candidate: string,
): string | undefined {
  if (!candidate) return undefined;
  const folded = folders.map((f) => ({ raw: f, key: foldName(f) }));
  const exact = folded.find((f) => f.key === candidate);
  if (exact) return exact.raw;
  const starts = folded.find((f) => f.key.startsWith(candidate));
  if (starts) return starts.raw;
  return folded.find((f) => f.key.includes(candidate))?.raw;
}

const SUB_EXT = /\.(srt|ass|ssa|sub|idx|sup|smi|zip|rar|7z)$/i;

/** Does a subtitle filename cover an episode? Direct number or batch range. */
export function fileMatchesEpisode(name: string, ep: string): boolean {
  // digit-boundary match so ep "21" doesn't hit year "2021"
  if (new RegExp(`(^|\\D)${ep}(\\D|$)`).test(name)) return true;
  const n = Number.parseInt(ep, 10);
  if (!Number.isFinite(n)) return false;
  const rangeRe = /(\d{2,4})\s*[-–~～]\s*(\d{2,4})/g;
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(name)) !== null) {
    const a = Number.parseInt(m[1], 10);
    const b = Number.parseInt(m[2], 10);
    if (a <= n && n <= b) return true;
  }
  return false;
}

/** Pure: folder page HTML -> subtitle file links. */
export function parseFolderFiles(html: string, folderUrl: string): KitsuSub[] {
  const out: KitsuSub[] = [];
  // anchors may wrap inner tags (<strong>), so capture lazily then strip tags
  const re = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const [, href, inner] = m;
    if (/dirlist\.php|dir=subtitles/i.test(href)) continue;
    const text = inner.replace(/<[^>]*>/g, "").trim();
    if (!SUB_EXT.test(href) && !SUB_EXT.test(text)) continue;
    try {
      const url = new URL(href, folderUrl).href;
      const name = text || href.split("/").pop() || "subtitle";
      if (!out.some((s) => s.url === url)) out.push({ name: name.trim(), url });
    } catch {
      // skip unresolvable hrefs
    }
  }
  return out;
}

export async function fetchKitsuIndex(timeoutMs: number): Promise<string[]> {
  const html = await (await fetchWithTimeout(KITSU_INDEX_URL, timeoutMs)).text();
  return parseIndexFolders(html);
}

export async function lookupAnimeSubs(
  title: string,
  timeoutMs: number,
): Promise<KitsuLookup> {
  const candidate = normalizeAnimeTitle(title);
  const episode = extractEpisodeNumber(title);
  const folders = await fetchKitsuIndex(timeoutMs);
  const folder = findBestFolder(folders, candidate);
  if (!folder) {
    return {
      anime: candidate || title,
      folderUrl: KITSU_INDEX_URL,
      episode,
      episodeFiltered: false,
      count: 0,
      subtitles: [],
    };
  }
  const folderUrl = `${KITSU_BASE}/dirlist.php?dir=subtitles%2Fjapanese%2F${encodeURIComponent(folder)}`;
  const html = await (await fetchWithTimeout(folderUrl, timeoutMs)).text();
  const files = parseFolderFiles(html, folderUrl);
  const filtered =
    episode != null
      ? files.filter((f) => fileMatchesEpisode(f.name, episode))
      : files;
  const episodeFiltered = episode != null && filtered.length > 0;
  const subtitles = (episodeFiltered ? filtered : files).slice(0, 100);
  return {
    anime: folder,
    folderUrl,
    episode,
    episodeFiltered,
    count: subtitles.length,
    subtitles,
  };
}
