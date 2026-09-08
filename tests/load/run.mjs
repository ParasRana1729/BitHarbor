#!/usr/bin/env node
/**
 * Production-scale load test. Spawns its own `next start` on :3105
 * (isolated rate-limit buckets from any other instance), then:
 *   1. warmup      — cold provider fan-out latency
 *   2. cache       — repeat queries must HIT and stay fast
 *   3. concurrency — 24 parallel mixed searches, zero 5xx/429
 *   4. burst       — 45 rapid same-IP requests must trip 429s with Retry-After
 *   5. subtitles   — imdb lookup works and caches
 *   6. recovery    — health 200 + fresh client unaffected after burst
 *
 * Virtual users send distinct X-Forwarded-For IPs (the app's client key),
 * exactly like distinct real clients. Only the burst phase shares one IP.
 * Upstream politeness: ~15 uncached fan-outs total; everything else is cache.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 3105;
const BASE = process.env.LOAD_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const REQ_TIMEOUT_MS = 60000;

const failures = [];
const ok = (cond, msg) => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${msg}`);
  if (!cond) failures.push(msg);
};
const pct = (arr, p) => {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function req(p, { ip, timeout = REQ_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${p}`, {
      signal: ctrl.signal,
      headers: ip ? { "X-Forwarded-For": ip } : {},
    });
    const took = Date.now() - started;
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* non-json */
    }
    return {
      status: res.status,
      took,
      cache: res.headers.get("x-cache"),
      retryAfter: res.headers.get("retry-after"),
      json,
    };
  } finally {
    clearTimeout(t);
  }
}

const ip = (i) => `10.9.0.${i}`;
const QUERIES = [
  "/api/search?q=dune&cat=movies",
  "/api/search?q=one%20piece&cat=anime",
  "/api/search?q=severance&cat=tv",
  "/api/search?q=ubuntu&cat=software",
  "/api/search?q=beatles&cat=music",
  "/api/search?q=dune&cat=books",
  "/api/search?q=doom&cat=games",
  "/api/search?q=dune&cat=all",
];

function startServer() {
  if (process.env.LOAD_BASE_URL) return null;
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
    { cwd: ROOT, stdio: "ignore", windowsHide: true },
  );
  return child;
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await req("/api/health", { timeout: 5000 });
      if (r.status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("server never came up");
}

async function main() {
  const server = startServer();
  try {
    await waitForHealth();
    console.log(`\n[1/6] warmup (cold fan-out)`);
    const cold = [];
    for (let i = 0; i < 3; i++) {
      const r = await req(QUERIES[i], { ip: ip(100 + i) });
      cold.push(r.took);
      ok(r.status === 200, `warmup ${i + 1}: 200 (got ${r.status}, ${r.took}ms)`);
      ok(r.json?.results?.length > 0, `warmup ${i + 1}: non-empty results`);
    }
    console.log(`  cold p50=${pct(cold, 50)}ms p95=${pct(cold, 95)}ms`);

    console.log(`\n[2/6] cache effectiveness (12x repeat)`);
    const cached = [];
    let hits = 0;
    for (let i = 0; i < 12; i++) {
      const r = await req(QUERIES[0], { ip: ip(200) });
      cached.push(r.took);
      if (r.cache === "HIT") hits++;
      if (r.status !== 200) ok(false, `repeat ${i}: expected 200, got ${r.status}`);
    }
    ok(hits >= 11, `cache hits ${hits}/12 (first is MISS)`);
    ok(pct(cached.slice(1), 95) < 1500, `cached p95=${pct(cached.slice(1), 95)}ms < 1500ms`);

    console.log(`\n[3/6] concurrency (24 parallel mixed)`);
    const jobs = Array.from({ length: 24 }, (_, i) =>
      req(QUERIES[i % QUERIES.length], { ip: ip(300 + i) }),
    );
    const res = await Promise.all(jobs);
    const bad = res.filter((r) => r.status >= 500);
    const limited = res.filter((r) => r.status === 429);
    const lat = res.filter((r) => r.status === 200).map((r) => r.took);
    ok(bad.length === 0, `zero 5xx (${bad.length})`);
    ok(limited.length === 0, `zero 429 across distinct clients (${limited.length})`);
    ok(lat.length >= 20, `valid responses ${lat.length}/24`);
    console.log(`  concurrent p50=${pct(lat, 50)}ms p95=${pct(lat, 95)}ms`);
    ok(pct(lat, 95) < 45000, `concurrent p95 < 45s`);

    console.log(`\n[4/6] burst (45 rapid, one IP -> 429s expected)`);
    const burst = [];
    for (let i = 0; i < 45; i++) burst.push(await req(QUERIES[1], { ip: ip(400) }));
    const r429 = burst.filter((r) => r.status === 429);
    const r200 = burst.filter((r) => r.status === 200);
    ok(r429.length >= 5, `rate limiter engaged (${r429.length}x 429)`);
    ok(
      r429.every((r) => r.retryAfter && Number(r.retryAfter) <= 60),
      `all 429s carry sane Retry-After`,
    );
    ok(r200.length > 0, `some burst requests still served (${r200.length}x 200)`);
    ok(burst.every((r) => r.status === 200 || r.status === 429), `burst: only 200/429, no 5xx`);

    console.log(`\n[5/6] subtitles endpoint`);
    const subs = [];
    for (let i = 0; i < 3; i++) {
      subs.push(await req("/api/subtitles?imdb=tt0133093&lang=English", { ip: ip(500) }));
    }
    ok(subs.every((r) => r.status === 200), `subtitle lookups all 200`);
    ok(subs[0].json?.count > 0, `matrix has english subs (${subs[0].json?.count})`);
    ok(subs[1].cache === "HIT" && subs[2].cache === "HIT", `subtitle cache HITs`);

    console.log(`\n[6/6] recovery`);
    const h = await req("/api/health");
    ok(h.status === 200 && h.json?.ok === true, `health 200 after burst`);
    const fresh = await req(QUERIES[2], { ip: ip(600) });
    ok(fresh.status === 200, `fresh client unaffected (${fresh.status})`);
  } finally {
    if (server) {
      server.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 3000));
      if (!server.killed) server.kill("SIGKILL");
    }
  }

  console.log(failures.length === 0 ? `\nLOAD OK\n` : `\nLOAD FAILED: ${failures.length}\n`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`LOAD ERROR: ${e.message}`);
  process.exit(1);
});
