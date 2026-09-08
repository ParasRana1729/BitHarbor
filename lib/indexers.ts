// Central config. No tracker presets hardcoded here on purpose:
// indexer choice is user configuration (see .env.example + docs),
// which keeps the template generic and reduces takedown surface.

export interface HarborConfig {
  torznabUrl: string;
  torznabApiKey: string;
  /** e.g. ["all"] or ["1337x","nyaasi","yts"] — Jackett indexer ids */
  defaultIndexers: string[];
  trustedUploaders: Set<string>;
  hideZeroSeed: boolean;
  maxResults: number;
  requestTimeoutMs: number;
  maxIndexersParallel: number;
  cacheTtlSeconds: number;
  rateLimitPerMin: number;
  demoMode: boolean;
}

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return fallback;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : fallback;
}

function parseIntEnv(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

let cached: HarborConfig | null = null;

export function getConfig(): HarborConfig {
  if (cached) return cached;
  const trusted = parseList(process.env.TRUSTED_UPLOADERS, []).map((s) =>
    s.toLowerCase(),
  );
  cached = {
    torznabUrl: (process.env.TORZNAB_URL ?? "").replace(/\/$/, ""),
    torznabApiKey: process.env.TORZNAB_API_KEY ?? "",
    defaultIndexers: parseList(process.env.INDEXERS, ["all"]),
    trustedUploaders: new Set(trusted),
    hideZeroSeed: parseBool(process.env.HIDE_ZERO_SEED, true),
    maxResults: parseIntEnv(process.env.MAX_RESULTS, 100),
    requestTimeoutMs: parseIntEnv(process.env.REQUEST_TIMEOUT_MS, 12000),
    maxIndexersParallel: parseIntEnv(process.env.MAX_INDEXERS_PARALLEL, 5),
    cacheTtlSeconds: parseIntEnv(process.env.CACHE_TTL_SECONDS, 300),
    rateLimitPerMin: parseIntEnv(process.env.RATE_LIMIT_PER_MIN, 30),
    demoMode: parseBool(process.env.DEMO_MODE, true),
  };
  return cached;
}

/** Test seam: reset memoized config (used by route handler in dev). */
export function _resetConfigCache(): void {
  cached = null;
}

export function isJackettConfigured(cfg: HarborConfig = getConfig()): boolean {
  return cfg.torznabUrl.length > 0 && cfg.torznabApiKey.length > 0;
}
