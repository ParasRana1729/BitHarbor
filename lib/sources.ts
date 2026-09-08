import { isBuiltinProvider, type BuiltinProviderId } from "./providers";

export interface ResolvedSources {
  builtinIds: BuiltinProviderId[];
  /** jackett indexer ids to query, ["all"] for feed-wide, or null to skip */
  jackettQuery: string[] | null;
  effectiveTrackers: string[];
  /** true when caller explicitly named a Jackett indexer we cannot serve */
  needsJackettError: boolean;
}

/**
 * Pure source-routing for /api/search. Rules:
 * - "all" (or default) => built-ins + Jackett default feed when configured
 * - explicit built-in ids => built-ins only
 * - explicit Jackett ids without configuration => needsJackettError
 * - unconfigured + non-explicit => built-ins, no error
 */
export function resolveSources(opts: {
  trackers: string[];
  defaultIndexers: string[];
  jackettConfigured: boolean;
  explicitTrackers: boolean;
}): ResolvedSources {
  const { trackers, defaultIndexers, jackettConfigured, explicitTrackers } = opts;
  const wantsAll = trackers.includes("all");
  const builtinIds = (
    wantsAll ? ["nyaa", "yts"] : trackers.filter((t) => isBuiltinProvider(t))
  ) as BuiltinProviderId[];
  const jackettIds = wantsAll
    ? defaultIndexers.filter((t) => t !== "all" && !isBuiltinProvider(t))
    : trackers.filter((t) => t !== "all" && !isBuiltinProvider(t));
  const queryJackettAll = wantsAll && defaultIndexers.includes("all");

  if (!jackettConfigured && explicitTrackers && jackettIds.length > 0) {
    return {
      builtinIds,
      jackettQuery: null,
      effectiveTrackers: [...builtinIds],
      needsJackettError: true,
    };
  }
  const jackettQuery =
    jackettConfigured && (jackettIds.length > 0 || queryJackettAll)
      ? queryJackettAll
        ? ["all"]
        : jackettIds
      : null;
  return {
    builtinIds,
    jackettQuery,
    effectiveTrackers: [...builtinIds, ...(jackettQuery ?? [])],
    needsJackettError: false,
  };
}
