# BitHarbor ⚓

Torrent meta-search with categories and matching subtitles.
Next.js + TypeScript. **No setup: no env files, no keys, no accounts.**
Just `npm install && npm run dev`.

## Sources (all keyless public feeds)

- **Nyaa** RSS — anime, live-action, music, books, software, games
- **YTS** API — movies, one result per quality, with IMDB ids
- **Pirate Bay** via the Apibay API — general, category-filtered, often with IMDB ids
- **YIFY Subtitles** — per-movie subtitles sorted by community rating

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

`GET /api/subtitles?imdb=tt0133093 | ?title=The+Matrix [&lang=English]`
→ `{ movieTitle, imdbId, count, subtitles: [{ language, rating, uploader, release, downloadUrl }] }`,
sorted best-match first, cached 1h.

Errors: `400 bad_query|bad_category|bad_tracker` · `429 rate_limited`
(with `Retry-After`) · `502 subtitle_unavailable`.

Behavior:

- Trust rule: hide 0-seed by default (`includeZero=1` overrides), trusted
  uploaders bypass the hide; sort seeders desc → trusted → leechers.
- Safety: 5-min search cache, per-IP rate limits, `Cache-Control: s-maxage=60`,
  **no query-content logging** (counts + timings only).

## Tests

```bash
npm test        # vitest: parsers, categories, ranking, cache, limits, routing, subtitles
npm run typecheck
npm run build
```

## Disclaimer

BitHarbor queries public feeds for content you have the right to download.
You are responsible for what you download. Subtitle downloads come straight
from YIFY Subtitles.
