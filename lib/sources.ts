import type { ProviderId } from "./providers";
import { categorySources } from "./categories";

export interface ResolvedSources {
  providers: ProviderId[];
  effectiveTrackers: string[];
  /** explicitly requested ids we don't know */
  invalid: string[];
}

/**
 * Pure source-routing for /api/search. No configuration anywhere:
 * - blank/"all" => every provider the category uses
 * - explicit ids => exactly those (validated; unknown go to `invalid`)
 */
export function resolveSources(
  trackers: string[],
  category: Parameters<typeof categorySources>[0],
): ResolvedSources {
  const cleaned = trackers.map((t) => t.toLowerCase()).filter((t) => t !== "all");
  if (cleaned.length === 0) {
    const src = categorySources(category);
    const providers: ProviderId[] = [];
    if (src.nyaa) providers.push("nyaa");
    if (src.yts) providers.push("yts");
    providers.push("tpb");
    // anime intentionally skips tpb (no anime categories there)
    const trimmed: ProviderId[] = category === "anime" ? ["nyaa"] : providers;
    return { providers: trimmed, effectiveTrackers: trimmed, invalid: [] };
  }
  const known: ProviderId[] = ["nyaa", "yts", "tpb"];
  const providers = cleaned.filter((t): t is ProviderId =>
    (known as string[]).includes(t),
  );
  const invalid = cleaned.filter((t) => !(known as string[]).includes(t));
  const deduped: ProviderId[] = Array.from(new Set(providers));
  return { providers: deduped, effectiveTrackers: deduped, invalid };
}
