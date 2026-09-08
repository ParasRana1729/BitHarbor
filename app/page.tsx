"use client";

import { useCallback, useState } from "react";
import type { SearchResponse, TorrentResult } from "@/lib/types";

function formatBytes(n: number): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[u]}`;
}

function formatAge(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 0) return "future";
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function ResultCard({ r }: { r: TorrentResult }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card">
      <div className="title">{r.title}</div>
      <div className="badges">
        <span className="badge">{r.tracker}</span>
        <span className="badge seed">
          ↑ {r.seeders} / ↓ {r.leechers}
        </span>
        <span className="badge">{formatBytes(r.sizeBytes)}</span>
        <span className="badge">{formatAge(r.publishedAt)}</span>
        {r.trusted && <span className="badge trusted">trusted uploader</span>}
        {r.uploader && <span className="badge">by {r.uploader}</span>}
      </div>
      <div className="actions">
        {r.magnetUri && (
          <>
            <a href={r.magnetUri}>Magnet</a>
            <button
              type="button"
              onClick={() => {
                void copyText(r.magnetUri ?? "").then((ok) => {
                  setCopied(ok);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied!" : "Copy magnet"}
            </button>
          </>
        )}
        {r.torrentUrl && (
          <a href={r.torrentUrl} rel="noreferrer" target="_blank">
            .torrent
          </a>
        )}
        {r.detailsUrl && (
          <a href={r.detailsUrl} rel="noreferrer" target="_blank">
            Details
          </a>
        )}
      </div>
    </div>
  );
}

export default function Home(): React.JSX.Element {
  const [q, setQ] = useState("");
  const [trackers, setTrackers] = useState("");
  const [includeZero, setIncludeZero] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);

  const run = useCallback(async () => {
    const query = q.trim();
    if (query.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query });
      if (trackers.trim()) params.set("trackers", trackers.trim());
      if (includeZero) params.set("includeZero", "1");
      const res = await fetch(`/api/search?${params.toString()}`);
      const json = (await res.json()) as SearchResponse & { message?: string };
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Rate limited — wait a few seconds and retry."
            : res.status === 503
              ? "Jackett not configured. Set TORZNAB_URL + TORZNAB_API_KEY on the server."
              : (json.message ?? `Search failed (HTTP ${res.status})`),
        );
        setData(null);
        return;
      }
      setData(json as SearchResponse);
    } catch {
      setError("Network error — is the server running?");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [q, trackers, includeZero, loading]);

  return (
    <main className="container">
      <div className="header">
        <h1>⚓ BitHarbor</h1>
        <p>
          Self-hostable torrent meta-search. Bring your own Jackett/Prowlarr —
          no tracker scraping in this app.
        </p>
      </div>

      <div className="searchbar">
        <input
          type="text"
          placeholder="Search across your configured indexers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          maxLength={100}
        />
        <button type="button" disabled={loading || q.trim().length < 2} onClick={() => void run()}>
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      <div className="controls">
        <label>
          Trackers (csv, blank = all):{" "}
          <input
            type="text"
            placeholder="e.g. nyaa,yts"
            value={trackers}
            onChange={(e) => setTrackers(e.target.value)}
            size={28}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeZero}
            onChange={(e) => setIncludeZero(e.target.checked)}
          />{" "}
          show 0-seed results
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      {data && (
        <div className="meta">
          {data.count} results for “{data.query}” · {data.tookMs}ms ·{" "}
          {data.cached ? "cache HIT" : "cache MISS"} · sorted by seeders
        </div>
      )}

      {data?.results.map((r) => <ResultCard key={r.id} r={r} />)}

      {data && data.results.length === 0 && (
        <div className="card">No results. Try fewer words or another tracker set.</div>
      )}

      <div className="footer">
        BitHarbor searches Nyaa + YTS out of the box, plus your Jackett/Prowlarr
        indexers when configured — see .env.example and FMHY for ideas. No
        query content is logged by default. Demo instances should enable
        DEMO_MODE + rate limits. Only download content you have the right to.
      </div>
    </main>
  );
}
