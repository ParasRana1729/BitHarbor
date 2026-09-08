// Tiny in-memory LRU cache with TTL. No persistence, no query logging.
// Key = normalized query + tracker set. Value = SearchResponse["results"].

interface Entry<T> {
  expiry: number;
  value: T;
}

const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 200;

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return null;
  }
  // LRU refresh: re-insert to mark recent
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (store.has(key)) store.delete(key);
  store.set(key, { expiry: Date.now() + ttlMs, value });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
}

export function buildCacheKey(q: string, trackers: string[]): string {
  const nq = q.trim().toLowerCase().replace(/\s+/g, " ");
  const nt = [...trackers].map((t) => t.toLowerCase()).sort().join(",");
  return `${nq}|${nt}`;
}

/** Test seam */
export function _clearCache(): void {
  store.clear();
}
