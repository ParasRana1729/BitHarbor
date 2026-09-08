import { PROVIDER_IDS, type ProviderId } from "./providers";
import { categorySources } from "./categories";

export interface ResolvedSources {
  providers: ProviderId[];
  effectiveTrackers: string[];
  /** explicitly requested ids we don't know */
  invalid: string[];
}

/** Default provider set for a category (tpb skipped for anime: no anime there). */
export function providersForCategory(
  category: Parameters<typeof categorySources>[0],
): ProviderId[] {
  const src = categorySources(category);
  const out: ProviderId[] = [];
  if (src.nyaa) out.push("nyaa");
  if (src.yts) out.push("yts");
  if (category !== "anime") out.push("tpb");
  if (src.solid) out.push("solid");
  if (src.eztv) out.push("eztv");
  return out;
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
    const providers = providersForCategory(category);
    return { providers, effectiveTrackers: [...providers], invalid: [] };
  }
  const known = PROVIDER_IDS as readonly string[];
  const providers = cleaned.filter((t): t is ProviderId => known.includes(t));
  const invalid = cleaned.filter((t) => !known.includes(t));
  const deduped: ProviderId[] = Array.from(new Set(providers));
  return { providers: deduped, effectiveTrackers: [...deduped], invalid };
}
