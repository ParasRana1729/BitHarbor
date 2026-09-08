# BitHarbor ⚓

Self-hostable torrent meta-search (Next.js + TypeScript).

Works out of the box with **zero configuration** via built-in providers
(Nyaa RSS + YTS API), and merges in your Jackett/Prowlarr indexers via Torznab
when `TORZNAB_URL` + `TORZNAB_API_KEY` are set. The app **never scrapes
tracker HTML**. Extra indexer choice is **your configuration** —
see `.env.example`.

## Quickstart (no config needed)

```bash
npm install
npm run dev   # → http://localhost:3000
```

Health: `GET /api/health` · Search: `GET /api/search?q=dune&trackers=all`

### Adding Jackett (for 1337x / TPB / TGx …)

1. Run Jackett somewhere (Docker or native), copy an API key + Torznab feed URL.
2. `cp .env.example .env` and set `TORZNAB_URL` + `TORZNAB_API_KEY`.
3. Restart. `trackers=all` now merges built-ins + your Jackett feed.

### Full compose (web + Jackett + FlareSolverr)

```bash
cp .env.example .env
# fill TORZNAB_API_KEY after first Jackett boot (Jackett UI -> Dashboard)
docker compose up --build
```

Jackett needs FlareSolverr for Cloudflare-protected trackers:
configure `http://flaresolverr:8191` in Jackett settings.

## API contract

`GET /api/search?q=<2..100 chars>&trackers=<csv|all>&includeZero=1`

```jsonc
{
  "query": "ubuntu",
  "trackers": ["all"],
  "cached": false,
  "tookMs": 812,
  "count": 24,
  "results": [
    {
      "id": "a3f9…",
      "title": "Ubuntu 24.04 Desktop",
      "tracker": "1337x",
      "infoHash": "…",
      "magnetUri": "magnet:?…",
      "torrentUrl": "https://…/x.torrent",
      "detailsUrl": "https://…/torrent/…",
      "seeders": 412,
      "leechers": 37,
      "sizeBytes": 5905580032,
      "publishedAt": "2026-…",
      "uploader": "trusted-name",
      "trusted": true
    }
  ]
}
```

Errors: `400 bad_query` · `429 rate_limited` (with `Retry-After`) ·
`503 jackett_not_configured` (only when you explicitly name a Jackett indexer
that isn't configured).

Behavior (grilled spec):

- Fan-out with `MAX_INDEXERS_PARALLEL` (default 5), per-indexer failure is non-fatal.
- Trust rule: hide 0-seed by default (`HIDE_ZERO_SEED`), trusted uploaders
  bypass the hide; sort seeders desc → trusted → leechers.
- Demo safety: 5-min in-memory LRU cache (`CACHE_TTL_SECONDS`), 30 req/min/IP
  sliding window (`RATE_LIMIT_PER_MIN`), `Cache-Control: s-maxage=60`,
  **no query-content logging** (counts + timings only).
- `GET /api/health` → `{ ok, jackettConfigured, time }`.

## Configuration

See `.env.example`. Suggested FMHY general starting indexers (verify ids in your
Jackett UI — do **not** hardcode these into forks you publish):

`1337x, thepiratebay, torrentgalaxy, nyaasi`

## Tests

```bash
npm test        # vitest: parsers, ranking, cache, rate limit, source routing (31 tests)
npm run typecheck
npm run build
```

## Disclaimer

BitHarbor is a search template for content you have the right to download.
You operate your own Jackett + indexer set and are responsible for what you
configure, host, and download. Demo hosts: keep `DEMO_MODE=true`, rate limits
on, and expect tracker IPs to get banned/flagged — the demo is disposable.
