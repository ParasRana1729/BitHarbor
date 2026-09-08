// Canonical BitHarbor result schema.
// Everything downstream (API, UI, cache) uses this — never raw Torznab XML.

export interface TorrentResult {
  /** stable id: sha1(tracker + infoHash/title) truncated */
  id: string;
  title: string;
  /** provider id: "nyaa" | "yts" | "tpb" */
  tracker: string;
  infoHash?: string;
  magnetUri?: string;
  /** direct .torrent URL (provider CDN or tracker link) */
  torrentUrl?: string;
  /** provider details page */
  detailsUrl?: string;
  /** imdb id (tt...) when the provider supplies it — powers subtitles */
  imdbId?: string;
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
  category: string;
  trackers: string[];
  cached: boolean;
  tookMs: number;
  count: number;
  results: TorrentResult[];
}
