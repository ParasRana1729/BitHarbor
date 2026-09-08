# BitHarbor ⚓

Torrent meta-search with categories and matching subtitles.
Next.js + TypeScript. **No setup: no env files, no keys, no accounts.**
Just `npm install && npm run dev`.

## Sources (all keyless public feeds)

- **Nyaa** RSS — anime, live-action, music, books, software, games
- **YTS** API — movies, one result per quality, with IMDB ids
- **Pirate Bay** via the Apibay API — general, category-filtered, often with IMDB ids
- **SolidTorrents** API — DHT index, verified flag, all categories
- **EZTV** API (+ TVMaze title resolution) — TV episodes per show
- **YIFY Subtitles** — per-movie subtitles sorted by community rating,
  with episode matching (`S01E02` filtered against release tags)
- **kitsunekko.net** — Japanese anime subtitles matched to anime + episode
  (including batch-range packs like `0001-0130`)

Pick a category (All, Movies, TV Shows, Anime, Music, Books, Software, Games)
and BitHarbor queries the right corners of each feed. Toggle providers, sort by
seeders / age / size, copy magnet links or grab `.torrent` files.

Video results with an IMDB id get a **Subtitles** button: best-match subtitles
for that exact title, filterable by language, direct zip download.

## Quickstart

```bash
npm install
npm run dev   # → http://localhost:3000
```

Or `docker compose up --build`. Health: `GET /api/health`.

## API

`GET /api/search?q=<2..100 chars>&cat=<all|movies|tv|anime|music|books|software|games>&trackers=<nyaa,yts,tpb|all>&includeZero=1`

```jsonc
{
  "query": "dune",
  "category": "movies",
  "trackers": ["nyaa", "yts", "tpb"],
  "cached": false,
  "tookMs": 1045,
  "count": 50,
  "results": [
    {
      "id": "a3f9…",
      "title": "Dune: Part One (2021) [1080p]",
      "tracker": "yts",
      "infoHash": "…",
      "magnetUri": "magnet:?…",
      "torrentUrl": "https://…",
      "detailsUrl": "https://…",
      "imdbId": "tt1160419",
      "seeders": 100,
      "leechers": 44,
      "sizeBytes": 2147483648,
      "publishedAt": "2026-…",
      "uploader": "YTS",
      "trusted": true
    }
  ]
}
```

`GET /api/subtitles?imdb=tt0133093 | ?title=The+Matrix [&lang=English] [&ep=S01E02]`
→ `{ movieTitle, imdbId, episode, episodeFiltered, count, subtitles: [{ language, rating, uploader, release, downloadUrl }] }`,
sorted best-match first, cached 1h. Missing titles return an empty list, not an error.

`GET /api/anime-subs?title=<nyaa release title>`
→ `{ anime, episode, episodeFiltered, count, subtitles: [{ name, url }] }`,
Japanese subs for the exact anime + episode, cached 24h.

Errors: `400 bad_query|bad_category|bad_tracker` · `429 rate_limited`
(with `Retry-After`) · `502 subtitle_unavailable`.

Behavior:

- Trust rule: hide 0-seed by default (`includeZero=1` overrides), trusted
  uploaders bypass the hide; sort seeders desc → trusted → leechers.
- Safety: 5-min search cache, per-IP rate limits, `Cache-Control: s-maxage=60`,
  **no query-content logging** (counts + timings only).

## Tests

Three layers — unit, browser, and load:

```bash
npm test        # vitest: 76 unit tests (parsers, ranking, cache incl.
                #   eviction bound, rate-limit windows, provider timeouts,
                #   partial-provider failure, subtitle/episode matching)
npm run test:e2e # playwright + chromium: 14 tests, real build + live feeds
                #   (search flows per category, theme persistence, / shortcut,
                #   sort ordering, subtitle downloads, provider chips, mobile,
                #   zero console/page errors)
npm run test:load # node harness, own prod server: cold latency, cache HITs,
                #   24-way concurrency (0x 5xx), 429 burst behavior, subtitles,
                #   post-burst recovery
npm run typecheck
npm run build
```

## Disclaimer

BitHarbor queries public feeds for content you have the right to download.
You are responsible for what you download. Subtitle downloads come straight
from YIFY Subtitles.
