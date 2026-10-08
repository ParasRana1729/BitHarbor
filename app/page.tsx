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


const ART_PLATES = [
  {
    id: "clippership",
    name: "The Three-Masted Clipper Ship",
    src: "/harbor/platform-art.webp",
  },
  {
    id: "compass",
    name: "The Celestial Mariner's Compass",
    src: "/harbor/feature-compass.webp",
  },
];

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

  // Quickstart terminal drawer state
  const [showSelfHost, setShowSelfHost] = useState(false);
  const [artIndex, setArtIndex] = useState(0);
  const [termTab, setTermTab] = useState<"docker" | "curl" | "torznab">("docker");
  const [termCopied, setTermCopied] = useState(false);

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
      setError("network error talking to /api/search");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [q, cat, sources, includeZero, loading]);

  const sorted = useMemo(() => {
    if (!data) return [];
    const copy = [...data.results];
    switch (sort) {
      case "seeders":
        return copy.sort((a, b) => b.seeders - a.seeders);
      case "newest":
        return copy.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      case "biggest":
        return copy.sort((a, b) => b.sizeBytes - a.sizeBytes);
      case "smallest":
        return copy.sort((a, b) => a.sizeBytes - b.sizeBytes);
      default:
        return copy;
    }
  }, [data, sort]);

  const breakdown = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.results) {
      counts.set(r.tracker, (counts.get(r.tracker) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const termCommands = {
    docker: "docker run -d -p 3000:3000 --name bitharbor ghcr.io/parasrana1729/bitharbor:latest",
    curl: "curl -s 'http://localhost:3000/api/search?q=ubuntu&cat=software'",
    torznab: "http://localhost:3000/api/search?q={query}&cat={category}",
  };

  const hasSearched = data !== null;

  return (
    <main className={`container ${hasSearched ? "has-results" : "search-home"}`}>
      <div className="global-noise" aria-hidden="true" />

      {/* Topbar Header */}
      <header className="topbar">
        <div className="brand-group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/harbor/anchor.svg"
            alt="BitHarbor Anchor"
            className="brand-wing"
            width={20}
            height={20}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/harbor/lighthouse.svg"
            alt="BitHarbor Beacon"
            className="brand-mascot-pill"
            width={22}
            height={30}
          />
          <div className="brand mono">~/bitharbor</div>
        </div>

        <nav className="header-nav">
          <button
            type="button"
            className="selfhost-btn mono"
            onClick={() => setShowSelfHost((v) => !v)}
            title="view self-host docker & api commands"
          >
            {showSelfHost ? "✕ close" : "⇲ self-host / api"}
          </button>
          <button
            type="button"
            className="theme-toggle mono"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="toggle theme"
          >
            {theme === "dark" ? "◐ light" : "◑ dark"}
          </button>
        </nav>
      </header>

      {/* Expandable Self-Host / API Drawer (Zero space when collapsed) */}
      {showSelfHost && (
        <div className="selfhost-drawer mono">
          <div className="selfhost-header">
            <span>SELF-HOST NODE // DOCKER &amp; REST API</span>
            <span className="mono dim">v0.1</span>
          </div>
          <div className="terminal-card">
            <div className="terminal-tabs">
              <button
                type="button"
                className={termTab === "docker" ? "terminal-tab active" : "terminal-tab"}
                onClick={() => setTermTab("docker")}
              >
                Docker
              </button>
              <button
                type="button"
                className={termTab === "curl" ? "terminal-tab active" : "terminal-tab"}
                onClick={() => setTermTab("curl")}
              >
                cURL API
              </button>
              <button
                type="button"
                className={termTab === "torznab" ? "terminal-tab active" : "terminal-tab"}
                onClick={() => setTermTab("torznab")}
              >
                Torznab
              </button>
            </div>
            <div className="terminal-body">
              <span className="terminal-code">{termCommands[termTab]}</span>
              <button
                type="button"
                className="terminal-copy"
                onClick={() => {
                  void copyText(termCommands[termTab]).then((ok) => {
                    setTermCopied(ok);
                    setTimeout(() => setTermCopied(false), 1500);
                  });
                }}
              >
                {termCopied ? "copied ✓" : "copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google-Style Centered Search Engine Core */}
      <div className="search-stage">
        {/* Pure Copperplate Engraving Plate (No font inside art; click to toggle between Clipper & Compass) */}
        <div
          className="masthead-vignette"
          title="Click to toggle between Clipper Ship and Mariner's Compass // BitHarbor"
          onClick={() => setArtIndex((i) => (i + 1) % ART_PLATES.length)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setArtIndex((i) => (i + 1) % ART_PLATES.length);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ART_PLATES[artIndex].src}
            alt={ART_PLATES[artIndex].name}
            className="masthead-art"
            width={260}
            height={160}
          />
        </div>

        <div className="hero-text">
          <div className="kicker mono">Open-source · Decentralized Swarm Search · Zero Logs</div>
          <h1>Safe Harbor in Digital Seas</h1>
        </div>

        {/* 8 Category Tabs */}
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

        {/* Main Search Prompt with Animated Conic Border */}
        <div className="prompt hw-arc">
          <span className="dollar"><span>⚓</span><span className="coord-mark mono">/</span></span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search torrents across open swarms…  ( / to focus )"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
            maxLength={100}
            aria-label="Search torrents"
            autoFocus
          />
          <button
            type="button"
            disabled={loading || q.trim().length < 2}
            onClick={() => void run()}
          >
            {loading ? "…" : "↵"}
          </button>
        </div>

        {/* Tracker Source Chips & Sorting Controls */}
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
            sort:{" "}
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
            />{" "}
            0-seed
          </label>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Instant Search Meta & Results (Rendered immediately below search bar) */}
      {data && (
        <div className="meta mono">
          {data.count} results · {data.tookMs}ms · {data.cached ? "cache hit" : "live"} ·{" "}
          {breakdown.map(([t, n]) => `${t}×${n}`).join(" ")}
        </div>
      )}

      <section className="results">
        {sorted.map((r) => (
          <ResultCard key={r.id} r={r} />
        ))}
      </section>

      {data && data.results.length === 0 && (
        <div className="card">no results — try fewer words or another category.</div>
      )}

      {/* Streamlined Minimalist Google-Style Footer */}
      <footer className="compact-footer mono">
        <div className="footer-line">
          <span>nyaa · yts · tpb · solid · eztv · yify subs · kitsunekko jp subs</span>
          <span className="footer-tag">only grab what you have the right to.</span>
        </div>
        <div className="ghost" aria-hidden="true">
          BITHARBOR
        </div>
      </footer>
    </main>
  );
}
