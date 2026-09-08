import type { TorrentResult } from "./types";

/**
 * Trust + ranking rule (grilled spec), shared by the API route and tests:
 * - hide 0-seed results by default; trusted uploaders bypass the hide
 * - sort: seeders desc -> trusted first -> leechers desc
 * - cap at maxResults
 */
export function rankResults(
  results: TorrentResult[],
  opts: { hideZeroSeed: boolean; maxResults: number },
): TorrentResult[] {
  const filtered = results.filter((r) => {
    if (r.trusted) return true;
    if (opts.hideZeroSeed && r.seeders <= 0) return false;
    return true;
  });
  filtered.sort((a, b) => {
    if (b.seeders !== a.seeders) return b.seeders - a.seeders;
    if (a.trusted !== b.trusted) return a.trusted ? -1 : 1;
    return b.leechers - a.leechers;
  });
  return filtered.slice(0, Math.max(1, opts.maxResults));
}
