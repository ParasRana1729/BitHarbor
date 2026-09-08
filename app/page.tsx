"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import type { SearchResponse, TorrentResult } from "@/lib/types";

const SOURCES = [
  { id: "nyaa", label: "Nyaa", hint: "anime & more" },
  { id: "yts", label: "YTS", hint: "movies" },
  { id: "tpb", label: "Pirate Bay", hint: "general" },
  { id: "solid", label: "Solid", hint: "dht search" },
  { id: "eztv", label: "EZTV", hint: "tv episodes" },
] as const;

const ALL_SOURCES = SOURCES.map((s) => s.id);

type SortKey = "seeders" | "newest" | "biggest" | "smallest";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "seeders", label: "top seeders" },
  { id: "newest", label: "newest" },
  { id: "biggest", label: "biggest" },
  { id: "smallest", label: "smallest" },
];

type Theme = "dark" | "light";

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
  episode: string | null;
  episodeFiltered: boolean;
  count: number;
  subtitles: SubEntry[];
}

interface KitsuResponse {
  anime: string;
  episode?: string;
  episodeFiltered: boolean;
  count: number;
  subtitles: { name: string; url: string }[];
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
  return `${v.toFixed(v >= 100 ? 0 : 1)}${units[u]}`;
}

function formatAge(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 0) return "future";
  if (days === 0) return "today";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

function seasonEpisode(title: string): string | undefined {
  const m = title.match(/S(\d{1,2})E(\d{1,3})/i);
  if (!m) return undefined;
  return `S${m[1].padStart(2, "0")}E${m[2].padStart(2, "0")}`.toUpperCase();
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
  const ep = seasonEpisode(title);

  const load = useCallback(
    async (nextLang: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ imdb: imdbId });
        if (nextLang !== "All") params.set("lang", nextLang);
        if (ep) params.set("ep", ep);
        const res = await fetch(`/api/subtitles?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData((await res.json()) as SubResponse);
      } catch {
        setError("subtitles unavailable right now");
      } finally {
        setLoading(false);
      }
    },
    [imdbId, ep],
  );

  return (
    <span className="subs">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !data && !loading) void load(lang);
        }}
      >
        {open ? "hide subs" : "subtitles"}
      </button>
      {open && (
        <span className="subs-panel">
          <span className="subs-controls">
            <select
              value={lang}
              onChange={(e) => {
                setLang(e.target.value);
                void load(e.target.value);
              }}
            >
              <option value="English">en</option>
              <option value="All">all langs</option>
              {data &&
                Array.from(new Set(data.subtitles.map((s) => s.language)))
                  .filter((l) => l !== "English")
                  .sort()
                  .map((l) => (
                    <option key={l} value={l}>
                      {l.slice(0, 12)}
                    </option>
                  ))}
            </select>
            {data && (
              <span className="meta">
                {data.count} for “{data.movieTitle}”
                {data.episode && (data.episodeFiltered ? ` · ✓ ${data.episode}` : ` · no ${data.episode} tags`)}
              </span>
            )}
          </span>
          {loading && <span className="meta">loading…</span>}
          {error && <span className="error-inline">{error}</span>}
          {data?.subtitles.map((s) => (
            <span key={s.id} className="sub-row">
              <span className="tag">{s.language}</span>
              <span className="tag star">★{s.rating}</span>
              {s.uploader && <span className="meta">@{s.uploader}</span>}
              {s.release && <span className="meta cut">{s.release}</span>}
              <a href={s.downloadUrl} rel="noreferrer" target="_blank">
                ↓ zip
              </a>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

function KitsuSubs({ title }: { title: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<KitsuResponse | null>(null);

  return (
    <span className="subs">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !data && !loading) {
            setLoading(true);
            setError(null);
            fetch(`/api/anime-subs?title=${encodeURIComponent(title)}`)
              .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
              })
              .then((j) => setData(j as KitsuResponse))
              .catch(() => setError("anime subs unavailable right now"))
              .finally(() => setLoading(false));
          }
        }}
      >
        {open ? "hide jp subs" : "jp subs"}
      </button>
      {open && (
        <span className="subs-panel">
          {loading && <span className="meta">loading…</span>}
          {error && <span className="error-inline">{error}</span>}
          {data && (
            <span className="meta">
              {data.count} JP for “{data.anime}”
              {data.episode && (data.episodeFiltered ? ` · ✓ ep ${data.episode}` : "")}
            </span>
          )}
          {data?.subtitles.map((s) => (
            <span key={s.url} className="sub-row">
              <span className="meta cut">{s.name}</span>
              <a href={s.url} rel="noreferrer" target="_blank">
                ↓ sub
              </a>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

function ResultCard({ r }: { r: TorrentResult }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <article
      className="card"
      data-testid="result"
      data-seeders={r.seeders}
      data-size={r.sizeBytes}
      data-published={r.publishedAt}
    >
      <div className="title">{r.title}</div>
      <div className="meta-row mono">
        <span className="src">{r.tracker}</span>
        <span className="seeds">▲{r.seeders} ▼{r.leechers}</span>
        <span>{formatBytes(r.sizeBytes)}</span>
        <span>{formatAge(r.publishedAt)}</span>
        {r.trusted && <span className="trusted">trusted</span>}
        {r.uploader && <span className="dim">@{r.uploader}</span>}
      </div>
      <div className="actions">
        {r.magnetUri && (
          <>
            <a href={r.magnetUri}>magnet</a>
            <button
              type="button"
              onClick={() => {
                void copyText(r.magnetUri ?? "").then((ok) => {
                  setCopied(ok);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "copied ✓" : "copy"}
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
            details
          </a>
        )}
        {r.imdbId && <Subtitles imdbId={r.imdbId} title={r.title} />}
        {r.tracker === "nyaa" && <KitsuSubs title={r.title} />}
      </div>
    </article>
  );
}

export default function Home(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>("dark");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryId>("all");
  const [sources, setSources] = useState<string[]>([...ALL_SOURCES]);
  const [sort, setSort] = useState<SortKey>("seeders");
  const [includeZero, setIncludeZero] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("bitharbor-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("bitharbor-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleSource = (id: string): void => {
    setSources((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      return next.length === 0 ? [...ALL_SOURCES] : next;
    });
  };

  const run = useCallback(async () => {
    const query = q.trim();
    if (query.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query, cat });
      if (sources.length < ALL_SOURCES.length) params.set("trackers", sources.join(","));
      if (includeZero) params.set("includeZero", "1");
      const res = await fetch(`/api/search?${params.toString()}`);
      const json = (await res.json()) as SearchResponse & { message?: string };
      if (!res.ok) {
        setError(
          res.status === 429
            ? "rate limited — wait a few seconds and retry"
            : (json.message ?? `search failed (http ${res.status})`),
        );
        setData(null);
        return;
      }
      setData(json as SearchResponse);
    } catch {
      setError("network error — is the server running?");
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
      <header className="topbar">
        <div className="brand mono">~/bitharbor</div>
        <button
          type="button"
          className="theme-toggle mono"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title="toggle theme"
        >
          {theme === "dark" ? "◐ light" : "◑ dark"}
        </button>
      </header>

      <div className="hero">
        <h1>find it. grab it.</h1>
        <p>torrents across five open feeds. no setup, no accounts. make it yours.</p>
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

      <div className="prompt">
        <span className="dollar">$</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="search torrents…  ( / to focus )"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          maxLength={100}
          aria-label="Search torrents"
        />
        <button type="button" disabled={loading || q.trim().length < 2} onClick={() => void run()}>
          {loading ? "…" : "↵"}
        </button>
      </div>

      <div className="controls mono">
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
          sort:{` `}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="zero">
          <input
            type="checkbox"
            checked={includeZero}
            onChange={(e) => setIncludeZero(e.target.checked)}
          />{` `}
          0-seed
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      {data && (
        <div className="meta mono">
          {data.count} results · {data.tookMs}ms · {data.cached ? "cache hit" : "live"} ·{" "}
          {breakdown.map(([t, n]) => `${t}×${n}`).join(" ")}
        </div>
      )}

      <section className="results">
        {results.map((r) => (
          <ResultCard key={r.id} r={r} />
        ))}
      </section>

      {data && data.results.length === 0 && (
        <div className="card">no results — try fewer words or another category.</div>
      )}

      <footer className="footer mono">
        <span>nyaa · yts · tpb · solid · eztv · yify subs · kitsunekko jp subs</span>
        <span>only grab what you have the right to.</span>
      </footer>
    </main>
  );
}
