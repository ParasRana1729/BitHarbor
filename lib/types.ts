// Canonical BitHarbor result schema.
// Everything downstream (API, UI, cache) uses this — never raw Torznab XML.

export interface TorrentResult {
  /** stable id: sha1(tracker + infoHash/title) truncated */
  id: string;
  title: string;
  /** Jackett indexer id, e.g. "1337x", "nyaasi", "yts" */
  tracker: string;
  infoHash?: string;
  magnetUri?: string;
  /** direct .torrent URL (Jackett proxied or tracker link) */
  torrentUrl?: string;
  /** tracker details page */
  detailsUrl?: string;
  seeders: number;
  leechers: number;
  sizeBytes: number;
  /** ISO timestamp */
  publishedAt: string;
  uploader?: string;
  trusted: boolean;
}

export interface SearchResponse {
  query: string;
  trackers: string[];
  cached: boolean;
  tookMs: number;
  count: number;
  results: TorrentResult[];
}

export interface SearchQueryParams {
  q: string;
  /** comma-separated indexer ids, or ["all"] */
  trackers: string[];
  includeZero: boolean;
}
