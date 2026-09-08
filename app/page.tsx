"use client";

import { useCallback, useMemo, useState } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import type { SearchResponse, TorrentResult } from "@/lib/types";

const SOURCES = [
  { id: "nyaa", label: "Nyaa", hint: "anime & more" },
  { id: "yts", label: "YTS", hint: "movies" },
  { id: "tpb", label: "Pirate Bay", hint: "general" },
] as const;

type SortKey = "seeders" | "newest" | "biggest" | "smallest";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "seeders", label: "Top seeders" },
  { id: "newest", label: "Newest" },
  { id: "biggest", label: "Biggest" },
  { id: "smallest", label: "Smallest" },
];

interface SubEntry {
  id: string;
  language: string;
  rating: number;
  uploader?: string;
  release?: string;
  downloadUrl: string;
}

interface SubResponse {
  movieTitle: string;
  imdbId?: string;
  count: number;
  subtitles: SubEntry[];
}

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

function Subtitles({ imdbId, title }: { imdbId: string; title: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SubResponse | null>(null);
  const [lang, setLang] = useState("English");

  const load = useCallback(
    async (nextLang: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ imdb: imdbId });
        if (nextLang !== "All") params.set("lang", nextLang);
        const res = await fetch(`/api/subtitles?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData((await res.json()) as SubResponse);
      } catch {
        setError("Subtitles unavailable right now.");
      } finally {
        setLoading(false);
      }
    },
    [imdbId],
  );

  const toggle = (): void => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!data && !loading) void load(lang);
  };

  return (
    <div className="subs">
      <button type="button" onClick={toggle}>
        {open ? "Hide subtitles" : "Subtitles"}
      </button>
      {open && (
        <div className="subs-panel">
          <div className="subs-controls">
            <label>
              Language:{" "}
              <select
                value={lang}
                onChange={(e) => {
                  setLang(e.target.value);
                  void load(e.target.value);
                }}
              >
                <option value="English">English</option>
                <option value="All">All languages</option>
                {data &&
                  Array.from(new Set(data.subtitles.map((s) => s.language)))
                    .filter((l) => l !== "English")
                    .sort()
                    .map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
              </select>
            </label>
            {data && (
              <span className="meta">
                {data.count} for “{data.movieTitle}”
              </span>
            )}
          </div>
          {loading && <div className="meta">Loading subtitles…</div>}
          {error && <div className="error">{error}</div>}
          {data && data.subtitles.length === 0 && !loading && (
            <div className="meta">No {lang} subtitles found for “{title}”.</div>
          )}
          {data?.subtitles.map((s) => (
            <div key={s.id} className="sub-row">
              <span className="badge">{s.language}</span>
              <span className="badge seed">★ {s.rating}</span>
              {s.uploader && <span className="meta">by {s.uploader}</span>}
              {s.release && <span className="meta cut">{s.release}</span>}
              <a href={s.downloadUrl} rel="noreferrer" target="_blank">
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
        {r.imdbId && <Subtitles imdbId={r.imdbId} title={r.title} />}
      </div>
    </div>
  );
}

export default function Home(): React.JSX.Element {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryId>("all");
  const [sources, setSources] = useState<string[]>(["nyaa", "yts", "tpb"]);
  const [sort, setSort] = useState<SortKey>("seeders");
  const [includeZero, setIncludeZero] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);

  const toggleSource = (id: string): void => {
    setSources((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      return next.length === 0 ? ["nyaa", "yts", "tpb"] : next;
    });
  };

  const run = useCallback(async () => {
    const query = q.trim();
    if (query.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query, cat });
      if (sources.length < 3) params.set("trackers", sources.join(","));
      if (includeZero) params.set("includeZero", "1");
      const res = await fetch(`/api/search?${params.toString()}`);
      const json = (await res.json()) as SearchResponse & { message?: string };
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Rate limited — wait a few seconds and retry."
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
  }, [q, cat, sources, includeZero, loading]);

  const results = useMemo(() => {
    if (!data) return [];
    const rows = [...data.results];
    if (sort === "newest") {
      rows.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    } else if (sort === "biggest") {
      rows.sort((a, b) => b.sizeBytes - a.sizeBytes);
    } else if (sort === "smallest") {
      rows.sort(
        (a, b) => (a.sizeBytes || Number.MAX_SAFE_INTEGER) - (b.sizeBytes || Number.MAX_SAFE_INTEGER),
      );
    }
    return rows;
  }, [data, sort]);

  const breakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data?.results ?? []) m.set(r.tracker, (m.get(r.tracker) ?? 0) + 1);
    return [...m.entries()];
  }, [data]);

  return (
    <main className="container">
      <div className="header">
        <h1>⚓ BitHarbor</h1>
        <p>Search torrents across Nyaa, YTS and Pirate Bay. No setup, no accounts.</p>
      </div>

      <div className="pills" role="tablist" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            className={cat === c.id ? "pill active" : "pill"}
            title={c.hint}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="searchbar">
        <input
          type="text"
          placeholder="Movies, anime, books, software…"
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
        <div className="chips">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sources.includes(s.id)}
              className={sources.includes(s.id) ? "chip active" : "chip"}
              title={s.hint}
              onClick={() => toggleSource(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="sort">
          Sort:{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
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
          {data.cached ? "cache HIT" : "cache MISS"} ·{" "}
          {breakdown.map(([t, n]) => `${t} ×${n}`).join(" · ")}
        </div>
      )}

      {results.map((r) => (
        <ResultCard key={r.id} r={r} />
      ))}

      {data && data.results.length === 0 && (
        <div className="card">No results. Try fewer words or another category.</div>
      )}

      <div className="footer">
        Results come from public feeds (Nyaa, YTS, Pirate Bay via Apibay) with
        subtitles matched per title on YIFY Subtitles. Only download content you
        have the right to.
      </div>
    </main>
  );
}
