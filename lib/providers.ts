import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { categorySources, type CategoryId } from "./categories";
import type { TorrentResult } from "./types";

/**
 * Zero-config providers. No API keys, no env files, no self-hosted indexers:
 * - nyaa: official Nyaa RSS feed (anime, live-action, audio, literature, software)
 * - yts: YTS movie API (movies, one result per quality, carries imdb ids)
 * - tpb: The Pirate Bay via the public Apibay API (general, carries imdb ids)
 */

export const PROVIDER_IDS = ["nyaa", "yts", "tpb", "solid", "eztv"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProvider(id: string): id is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(id.toLowerCase());
}

const NYAA_RSS_BASE = "https://nyaa.si/?page=rss&f=0";
export const YTS_API_URL = "https://movies-api.accel.li/api/v2/list_movies.json";
const APIBAY_URL = "https://apibay.org/q.php";
/** cap per TPB category request — apibay can return hundreds of rows */
const TPB_PER_CAT_CAP = 60;

const MAGNET_TRACKERS = [
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.openbittorrent.com:80",
  "udp://tracker.coppersurfer.tk:6969",
  "udp://glotorrents.pw:6969/announce",
  "udp://tracker.opentrackr.org:1337/announce",
];

export function buildMagnet(infoHash: string, name: string): string {
  const tr = MAGNET_TRACKERS.map((t) => `tr=${encodeURIComponent(t)}`).join("&");
  return `magnet:?xt=urn:btih:${infoHash.toLowerCase()}&dn=${encodeURIComponent(name)}&${tr}`;
}

/** Parse "1.4 GiB" / "700 MiB" / "123 B" style sizes into bytes. */
export function parseSizeToBytes(raw: string | undefined): number {
  if (!raw) return 0;
  const m = raw.trim().match(/^([\d.,]+)\s*([KMGT]?i?B)$/i);
  if (!m) return 0;
  const num = Number.parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(num)) return 0;
  const unit = m[2].toUpperCase();
  const pow: Record<string, number> = {
    B: 0,
    KB: 1,
    KIB: 1,
    MB: 2,
    MIB: 2,
    GB: 3,
    GIB: 3,
    TB: 4,
    TIB: 4,
  };
  const p = pow[unit];
  if (p === undefined) return 0;
  return Math.floor(num * 1024 ** p);
}

function stableId(tracker: string, seed: string): string {
  return createHash("sha1")
    .update(`${tracker}::${seed}`)
    .digest("hex")
    .slice(0, 16);
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "BitHarbor/0.2 (+personal meta-search)" },
    });
    if (!res.ok) throw new Error(`provider http ${res.status}`);
    return res;
  } finally {
    clearTimeout(t);
  }
}

const rssParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function int(v: unknown): number {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Normalize an imdb reference to "tt..." form. */
export function normalizeImdbId(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const m = raw.match(/(tt\d{4,})/);
  if (m) return m[1];
  // EZTV-style bare numeric ids ("0418372" -> "tt0418372")
  if (/^\d{7,8}$/.test(raw.trim())) return `tt${raw.trim()}`;
  return undefined;
}

/* ---------------- Nyaa ---------------- */

/** Pure: Nyaa RSS XML -> TorrentResult[]. Exported for tests. */
export function parseNyaaRss(xml: string): TorrentResult[] {
  let doc: unknown;
  try {
    doc = rssParser.parse(xml);
  } catch {
    return [];
  }
  const channel = (doc as Record<string, Record<string, Record<string, unknown>>>)
    ?.rss?.channel;
  if (!channel) return [];
  const raw = channel.item;
  if (!raw) return [];
  const items = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
  const out: TorrentResult[] = [];
  for (const item of items) {
    const title = str(item.title) ?? "untitled";
    const torrentUrl = str(item.link);
    const detailsUrl =
      str((item.guid as Record<string, unknown> | undefined)?.["#text"]) ??
      str(item.guid);
    const infoHash = str(item["nyaa:infoHash"])?.toLowerCase();
    const seeders = int(item["nyaa:seeders"]);
    const leechers = int(item["nyaa:leechers"]);
    const sizeBytes = parseSizeToBytes(str(item["nyaa:size"]));
    const trustedFlag = str(item["nyaa:trusted"])?.toLowerCase();
    const trusted = trustedFlag === "yes" || trustedFlag === "trusted";
    let publishedAt = new Date().toISOString();
    const pd = str(item.pubDate);
    if (pd) {
      const d = new Date(pd);
      if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    }
    if (!torrentUrl && !infoHash) continue;
    out.push({
      id: stableId("nyaa", infoHash ?? `${title}::${torrentUrl}`),
      title,
      tracker: "nyaa",
      infoHash,
      magnetUri: infoHash ? buildMagnet(infoHash, title) : undefined,
      torrentUrl,
      detailsUrl,
      seeders,
      leechers,
      sizeBytes,
      publishedAt,
      trusted,
    });
  }
  return out;
}

export async function searchNyaa(
  query: string,
  timeoutMs: number,
  category: string,
): Promise<TorrentResult[]> {
  const url = `${NYAA_RSS_BASE}&c=${encodeURIComponent(category)}&q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url, timeoutMs);
  return parseNyaaRss(await res.text());
}

/* ---------------- YTS ---------------- */

interface YtsTorrent {
  url?: string;
  hash?: string;
  quality?: string;
  type?: string;
  seeds?: number;
  peers?: number;
  size?: string;
  size_bytes?: number | string;
  date_uploaded?: string;
  date_uploaded_unix?: number;
}

interface YtsMovie {
  title_long?: string;
  imdb_code?: string;
  url?: string;
  torrents?: YtsTorrent[];
}

/** Pure: YTS list_movies JSON -> TorrentResult[]. Exported for tests. */
export function parseYtsResponse(json: unknown): TorrentResult[] {
  const movies = (json as { data?: { movies?: YtsMovie[] } })?.data?.movies;
  if (!Array.isArray(movies)) return [];
  const out: TorrentResult[] = [];
  for (const m of movies) {
    const base = m.title_long ?? "untitled";
    const detailsUrl = m.url;
    const imdbId = normalizeImdbId(m.imdb_code);
    for (const t of m.torrents ?? []) {
      const infoHash = t.hash?.toLowerCase();
      if (!infoHash) continue;
      const label = t.quality ? `${base} [${t.quality}]` : base;
      let publishedAt = new Date().toISOString();
      if (typeof t.date_uploaded_unix === "number" && t.date_uploaded_unix > 0) {
        publishedAt = new Date(t.date_uploaded_unix * 1000).toISOString();
      }
      const sizeBytes =
        typeof t.size_bytes === "number"
          ? t.size_bytes
          : typeof t.size_bytes === "string"
            ? Number.parseInt(t.size_bytes, 10) || parseSizeToBytes(t.size)
            : parseSizeToBytes(t.size);
      out.push({
        id: stableId("yts", infoHash),
        title: label,
        tracker: "yts",
        infoHash,
        magnetUri: buildMagnet(infoHash, label),
        torrentUrl: t.url,
        detailsUrl,
        imdbId,
        seeders: int(t.seeds),
        leechers: int(t.peers),
        sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
        publishedAt,
        uploader: "YTS",
        trusted: true,
      });
    }
  }
  return out;
}

export async function searchYts(
  query: string,
  timeoutMs: number,
): Promise<TorrentResult[]> {
  const url = `${YTS_API_URL}?query_term=${encodeURIComponent(query)}&limit=20&sort_by=like_count&order_by=desc`;
  const res = await fetchWithTimeout(url, timeoutMs);
  return parseYtsResponse(await res.json());
}

/* ---------------- TPB (Apibay) ---------------- */

interface ApibayRow {
  id?: string;
  name?: string;
  info_hash?: string;
  leechers?: string;
  seeders?: string;
  size?: string;
  username?: string;
  added?: string;
  status?: string;
  category?: string;
  imdb?: string;
}

const TPB_TRUSTED_STATUS = new Set(["vip", "admin", "moderator", "trusted"]);

/** Pure: Apibay q.php JSON -> TorrentResult[]. Exported for tests. */
export function parseApibayResponse(json: unknown): TorrentResult[] {
  if (!Array.isArray(json)) return [];
  const out: TorrentResult[] = [];
  for (const row of json as ApibayRow[]) {
    const infoHash = row.info_hash?.toLowerCase();
    const title = row.name ?? "untitled";
    // Apibay signals "no results" as a zero-hash placeholder row.
    if (!infoHash || /^0+$/.test(infoHash)) continue;
    const seeders = int(row.seeders);
    const leechers = int(row.leechers);
    const sizeBytes = int(row.size);
    const status = (row.status ?? "").toLowerCase();
    let publishedAt = new Date().toISOString();
    const added = Number.parseInt(row.added ?? "", 10);
    if (Number.isFinite(added) && added > 0) {
      publishedAt = new Date(added * 1000).toISOString();
    }
    out.push({
      id: stableId("tpb", infoHash),
      title,
      tracker: "tpb",
      infoHash,
      magnetUri: buildMagnet(infoHash, title),
      detailsUrl: row.id
        ? `https://thepiratebay.org/description.php?id=${encodeURIComponent(row.id)}`
        : undefined,
      imdbId: normalizeImdbId(row.imdb),
      seeders,
      leechers,
      sizeBytes,
      publishedAt,
      uploader: row.username || undefined,
      trusted: TPB_TRUSTED_STATUS.has(status),
    });
  }
  return out;
}

async function searchTpbCat(
  query: string,
  timeoutMs: number,
  cat: number | null,
): Promise<TorrentResult[]> {
  const url =
    cat === null
      ? `${APIBAY_URL}?q=${encodeURIComponent(query)}`
      : `${APIBAY_URL}?q=${encodeURIComponent(query)}&cat=${cat}`;
  const res = await fetchWithTimeout(url, timeoutMs);
  const rows = parseApibayResponse(await res.json());
  return rows.slice(0, TPB_PER_CAT_CAP);
}

export async function searchTpb(
  query: string,
  timeoutMs: number,
  cats: number[],
): Promise<TorrentResult[]> {
  const jobs =
    cats.length === 0
      ? [searchTpbCat(query, timeoutMs, null)]
      : cats.map((c) => searchTpbCat(query, timeoutMs, c));
  const settled = await Promise.all(jobs.map((j) => j.catch((): TorrentResult[] => [])));
  return settled.flat();
}

/* ---------------- SolidTorrents ---------------- */

const SOLID_API_URL = "https://solidtorrents.net/api/v1/search";

interface SolidResult {
  title?: string;
  infohash?: string;
  seeders?: number;
  leechers?: number;
  size?: number;
  category?: number;
  downloads?: number;
  verified?: boolean;
  updatedAt?: number | string;
}

/** Pure: SolidTorrents search JSON -> TorrentResult[]. Exported for tests. */
export function parseSolidResponse(json: unknown): TorrentResult[] {
  const results = (json as { results?: SolidResult[] })?.results;
  if (!Array.isArray(results)) return [];
  const out: TorrentResult[] = [];
  for (const r of results) {
    const infoHash = r.infohash?.toLowerCase();
    const title = r.title ?? "untitled";
    if (!infoHash || /^0+$/.test(infoHash)) continue;
    let publishedAt = new Date().toISOString();
    if (typeof r.updatedAt === "number" && r.updatedAt > 0) {
      // seconds or milliseconds — disambiguate by magnitude
      const ms = r.updatedAt < 1e12 ? r.updatedAt * 1000 : r.updatedAt;
      publishedAt = new Date(ms).toISOString();
    } else if (typeof r.updatedAt === "string" && r.updatedAt) {
      const d = new Date(r.updatedAt);
      if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    }
    out.push({
      id: stableId("solid", infoHash),
      title,
      tracker: "solid",
      infoHash,
      magnetUri: buildMagnet(infoHash, title),
      seeders: int(r.seeders),
      leechers: int(r.leechers),
      sizeBytes: int(r.size),
      publishedAt,
      trusted: r.verified === true,
    });
  }
  return out;
}

export async function searchSolid(
  query: string,
  timeoutMs: number,
  category: string,
): Promise<TorrentResult[]> {
  const url = `${SOLID_API_URL}?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&sort=seeders&page=1&limit=20&fuv=no`;
  const res = await fetchWithTimeout(url, timeoutMs);
  return parseSolidResponse(await res.json());
}

/* ---------------- EZTV (+TVMaze title resolution) ---------------- */

const TVMAZE_API_URL = "https://api.tvmaze.com/search/shows";
const EZTV_API_URL = "https://eztv.re/api/get-torrents";

/** Pure: TVMaze search JSON -> imdb ids (best first). Exported for tests. */
export function imdbsFromTvmaze(json: unknown, limit = 2): string[] {
  if (!Array.isArray(json)) return [];
  const out: string[] = [];
  for (const entry of json as { show?: { externals?: { imdb?: string } } }[]) {
    const id = normalizeImdbId(entry?.show?.externals?.imdb);
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

interface EztvTorrent {
  id?: number;
  hash?: string;
  filename?: string;
  title?: string;
  magnet_url?: string;
  torrent_url?: string;
  imdb_id?: string;
  season?: string;
  episode?: string;
  seeds?: number;
  peers?: number;
  size_bytes?: string;
  date_released_unix?: number;
}

/** Pure: EZTV get-torrents JSON -> TorrentResult[]. Exported for tests. */
export function parseEztvResponse(json: unknown, imdbId?: string): TorrentResult[] {
  const torrents = (json as { torrents?: EztvTorrent[] })?.torrents;
  if (!Array.isArray(torrents)) return [];
  const out: TorrentResult[] = [];
  for (const t of torrents) {
    const infoHash = t.hash?.toLowerCase();
    if (!infoHash || /^0+$/.test(infoHash)) continue;
    const title = t.filename ?? t.title ?? "untitled";
    let publishedAt = new Date().toISOString();
    if (typeof t.date_released_unix === "number" && t.date_released_unix > 0) {
      publishedAt = new Date(t.date_released_unix * 1000).toISOString();
    }
    out.push({
      id: stableId("eztv", infoHash),
      title,
      tracker: "eztv",
      infoHash,
      magnetUri: t.magnet_url || buildMagnet(infoHash, title),
      detailsUrl: undefined,
      imdbId: normalizeImdbId(t.imdb_id) ?? imdbId,
      seeders: int(t.seeds),
      leechers: int(t.peers),
      sizeBytes: int(t.size_bytes),
      publishedAt,
      uploader: "EZTV",
      trusted: true,
    });
  }
  return out;
}

async function searchEztvImdb(
  imdb: string,
  timeoutMs: number,
): Promise<TorrentResult[]> {
  // EZTV wants the bare numeric id ("0903747", not "tt0903747") —
  // the tt form silently disables filtering and returns the whole catalog.
  const numeric = imdb.replace(/^tt/i, "");
  const url = `${EZTV_API_URL}?imdb_id=${encodeURIComponent(numeric)}&limit=100`;
  const res = await fetchWithTimeout(url, timeoutMs);
  return parseEztvResponse(await res.json(), imdb);
}

export async function searchEztv(
  query: string,
  timeoutMs: number,
): Promise<TorrentResult[]> {
  const searchUrl = `${TVMAZE_API_URL}?q=${encodeURIComponent(query)}`;
  const searchRes = await fetchWithTimeout(searchUrl, timeoutMs);
  const imdbs = imdbsFromTvmaze(await searchRes.json());
  if (imdbs.length === 0) return [];
  const jobs = imdbs.map((id) =>
    searchEztvImdb(id, timeoutMs).catch((): TorrentResult[] => []),
  );
  return (await Promise.all(jobs)).flat();
}

/* ---------------- fan-out ---------------- */

/**
 * Fan-out across providers honoring the category map.
 * Per-provider failure resolves to []. No keys, no config.
 */
export async function searchProviders(
  query: string,
  ids: ProviderId[],
  timeoutMs: number,
  category: CategoryId,
): Promise<TorrentResult[]> {
  const src = categorySources(category);
  const jobs = ids.map((id): Promise<TorrentResult[]> => {
    if (id === "nyaa") {
      if (!src.nyaa) return Promise.resolve([]);
      return searchNyaa(query, timeoutMs, src.nyaa);
    }
    if (id === "yts") {
      if (!src.yts) return Promise.resolve([]);
      return searchYts(query, timeoutMs);
    }
    if (id === "solid") {
      if (!src.solid) return Promise.resolve([]);
      return searchSolid(query, timeoutMs, src.solid);
    }
    if (id === "eztv") {
      if (!src.eztv) return Promise.resolve([]);
      return searchEztv(query, timeoutMs);
    }
    return searchTpb(query, timeoutMs, src.tpb);
  });
  const settled = await Promise.all(jobs.map((j) => j.catch((): TorrentResult[] => [])));
  return settled.flat();
}
