import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { TorrentResult } from "./types";
import { getConfig } from "./indexers";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function toInt(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function stableId(tracker: string, seed: string): string {
  return createHash("sha1")
    .update(`${tracker}::${seed}`)
    .digest("hex")
    .slice(0, 16);
}

interface TorznabAttr {
  "@_name"?: string;
  "@_value"?: string;
}

/** Extract torznab:attr list into a plain dict (handles single vs array). */
function attrDict(item: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = item["torznab:attr"] as TorznabAttr | TorznabAttr[] | undefined;
  if (!raw) return out;
  const list = Array.isArray(raw) ? raw : [raw];
  for (const a of list) {
    if (a && typeof a["@_name"] === "string") {
      out[a["@_name"].toLowerCase()] = String(a["@_value"] ?? "");
    }
  }
  return out;
}

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

export function buildTorznabUrl(
  baseUrl: string,
  apiKey: string,
  indexer: string,
  query: string,
): string {
  // Jackett supports per-indexer or /all paths. baseUrl is expected to be
  // either ".../indexers/all/results/torznab" or ".../indexers/<id>/results/torznab".
  // If caller configured a per-indexer URL but asks for a different indexer,
  // rewrite the path segment when it matches the pattern.
  let url = baseUrl;
  if (indexer !== "all") {
    url = url.replace(/\/indexers\/[^/]+\/results\/torznab/, `/indexers/${encodeURIComponent(indexer)}/results/torznab`);
  }
  const u = new URL(url);
  u.searchParams.set("apikey", apiKey);
  u.searchParams.set("t", "search");
  u.searchParams.set("q", query);
  u.searchParams.set("extended", "1");
  return u.toString();
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`torznab http ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function parseTorznabXml(
  xml: string,
  tracker: string,
  trustedUploaders: Set<string>,
): TorrentResult[] {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const channel = (doc as Record<string, Record<string, Record<string, unknown>>>)
    ?.rss?.channel;
  if (!channel) return [];
  const rawItems = channel.item;
  if (!rawItems) return [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]) as Record<
    string,
    unknown
  >[];

  const results: TorrentResult[] = [];
  for (const item of items) {
    const title = firstString(item.title) ?? "untitled";
    const link = firstString(item.link);
    const comments = firstString(item.comments);
    const enclosure = item.enclosure as Record<string, string> | undefined;
    const pubDate = firstString(item.pubDate);
    const author = firstString(item.author);
    const attrs = attrDict(item);

    const seeders = toInt(attrs.seeders ?? attrs.seeders_, 0);
    // Torznab uses seeders+peers; some indexers emit leechers directly.
    const leechers = toInt(
      attrs.leechers ?? attrs.peers ?? attrs.leechers_,
      0,
    );
    const sizeBytes = toInt(
      attrs.size ?? enclosure?.["@_length"] ?? attrs.size_,
      0,
    );
    const infoHash = (
      attrs.infohash ??
      attrs.info_hash ??
      ""
    ).toLowerCase() || undefined;
    const magnetFromAttr = attrs.magneturl || undefined;
    const magnetUri =
      magnetFromAttr ??
      (link?.startsWith("magnet:") ? link : undefined);
    const torrentUrl =
      link && !link.startsWith("magnet:")
        ? link
        : enclosure?.["@_url"];
    const uploader =
      author ?? attrs.uploader ?? attrs.team ?? undefined;
    const trusted = uploader
      ? trustedUploaders.has(uploader.toLowerCase())
      : false;

    let publishedAt = new Date().toISOString();
    if (pubDate) {
      const d = new Date(pubDate);
      if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    // Skip rows with neither magnet nor torrent file — undownloadable.
    if (!magnetUri && !torrentUrl) continue;

    results.push({
      id: stableId(tracker, infoHash ?? `${title}::${torrentUrl ?? magnetUri}`),
      title,
      tracker,
      infoHash,
      magnetUri,
      torrentUrl,
      detailsUrl: comments,
      seeders,
      leechers,
      sizeBytes,
      publishedAt,
      uploader,
      trusted,
    });
  }
  return results;
}

async function queryOneIndexer(
  indexer: string,
  query: string,
): Promise<TorrentResult[]> {
  const cfg = getConfig();
  const url = buildTorznabUrl(cfg.torznabUrl, cfg.torznabApiKey, indexer, query);
  const xml = await fetchWithTimeout(url, cfg.requestTimeoutMs);
  return parseTorznabXml(xml, indexer, cfg.trustedUploaders);
}

/** Fan-out to N indexers with a small worker pool; failures resolve to []. */
export async function searchTorznabAll(
  query: string,
  trackers: string[],
): Promise<{ results: TorrentResult[]; trackersQueried: string[] }> {
  const cfg = getConfig();
  const list = trackers.length > 0 ? trackers : cfg.defaultIndexers;
  const queue = [...list];
  const out: TorrentResult[] = [];
  const queried: string[] = [];
  const workers: Promise<void>[] = [];
  const parallel = Math.min(cfg.maxIndexersParallel, queue.length);

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const indexer = queue.shift();
      if (!indexer) break;
      queried.push(indexer);
      try {
        const r = await queryOneIndexer(indexer, query);
        out.push(...r);
      } catch {
        // per-indexer failure is non-fatal by design
      }
    }
  }
  for (let i = 0; i < parallel; i++) workers.push(worker());
  await Promise.all(workers);
  return { results: out, trackersQueried: queried };
}
