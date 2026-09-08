import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { TorrentResult } from "./types";

/**
 * Built-in providers that need zero configuration:
 * - nyaa: official Nyaa RSS feed (anime + general)
 * - yts: YTS movie API (movies, one result per quality)
 * These merge with Jackett/Torznab results when Torznab is configured.
 */

export const BUILTIN_PROVIDER_IDS = ["nyaa", "yts"] as const;
export type BuiltinProviderId = (typeof BUILTIN_PROVIDER_IDS)[number];

export function isBuiltinProvider(id: string): id is BuiltinProviderId {
  return (BUILTIN_PROVIDER_IDS as readonly string[]).includes(id.toLowerCase());
}

const NYAA_RSS_URL = "https://nyaa.si/?page=rss&c=0_0&f=0";
const YTS_API_URL = "https://movies-api.accel.li/api/v2/list_movies.json";

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

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "BitHarbor/0.1 (+self-hosted meta-search)" },
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
    const detailsUrl = str((item.guid as Record<string, unknown> | undefined)?.["#text"]) ?? str(item.guid);
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

export async function searchNyaa(query: string, timeoutMs: number): Promise<TorrentResult[]> {
  const url = `${NYAA_RSS_URL}&q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url, timeoutMs);
  return parseNyaaRss(await res.text());
}

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

export async function searchYts(query: string, timeoutMs: number): Promise<TorrentResult[]> {
  const url = `${YTS_API_URL}?query_term=${encodeURIComponent(query)}&limit=20&sort_by=like_count&order_by=desc`;
  const res = await fetchWithTimeout(url, timeoutMs);
  return parseYtsResponse(await res.json());
}

/** Fan-out to built-in providers. Per-provider failure resolves to []. */
export async function searchBuiltin(
  query: string,
  ids: BuiltinProviderId[],
  timeoutMs: number,
): Promise<TorrentResult[]> {
  const jobs = ids.map((id) =>
    (id === "nyaa" ? searchNyaa(query, timeoutMs) : searchYts(query, timeoutMs)).catch(
      (): TorrentResult[] => [],
    ),
  );
  const settled = await Promise.all(jobs);
  return settled.flat();
}
