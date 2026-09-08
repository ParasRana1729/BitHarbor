/**
 * Content categories. Each maps to per-provider filters so one tap
 * searches the right corners of every feed — no config needed.
 */

export const CATEGORY_IDS = [
  "all",
  "movies",
  "tv",
  "anime",
  "music",
  "books",
  "software",
  "games",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export function isCategoryId(v: string): v is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(v);
}

export const CATEGORIES: { id: CategoryId; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "Everything" },
  { id: "movies", label: "Movies", hint: "YTS + TPB + Solid" },
  { id: "tv", label: "TV Shows", hint: "EZTV + TPB + Nyaa" },
  { id: "anime", label: "Anime", hint: "Nyaa + Solid" },
  { id: "music", label: "Music", hint: "TPB + Nyaa + Solid" },
  { id: "books", label: "Books", hint: "E-books + manga" },
  { id: "software", label: "Software", hint: "Apps + OS" },
  { id: "games", label: "Games", hint: "PC + console" },
];

/** Categories where a subtitle button makes sense. */
export const VIDEO_CATEGORIES: readonly CategoryId[] = ["movies", "tv", "anime"];

export function isVideoCategory(cat: CategoryId): boolean {
  return (VIDEO_CATEGORIES as readonly string[]).includes(cat);
}

export interface CategorySources {
  /** Nyaa `c` filter (e.g. "1_0"), or null to skip Nyaa */
  nyaa: string | null;
  yts: boolean;
  /** TPB category codes; [] = one unfiltered query */
  tpb: number[];
  /** SolidTorrents category slug, or null to skip */
  solid: string | null;
  eztv: boolean;
}

/**
 * Nyaa filters: 1_0 anime, 2_0 audio, 3_0 literature, 4_0 live action,
 * 6_1 applications, 6_2 games.
 * TPB codes: 201/207 movies, 205/208 tv, 101 music, 601 e-books,
 * 301 windows apps, 401 pc games.
 * SolidTorrents slugs: movies, tv, anime, music, books, apps, games.
 */
export function categorySources(cat: CategoryId): CategorySources {
  switch (cat) {
    case "movies":
      return { nyaa: "4_0", yts: true, tpb: [201, 207], solid: "movies", eztv: false };
    case "tv":
      return { nyaa: "4_0", yts: false, tpb: [205, 208], solid: "tv", eztv: true };
    case "anime":
      return { nyaa: "1_0", yts: false, tpb: [], solid: "anime", eztv: false };
    case "music":
      return { nyaa: "2_0", yts: false, tpb: [101], solid: "music", eztv: false };
    case "books":
      return { nyaa: "3_0", yts: false, tpb: [601], solid: "books", eztv: false };
    case "software":
      return { nyaa: "6_1", yts: false, tpb: [301], solid: "apps", eztv: false };
    case "games":
      return { nyaa: "6_2", yts: false, tpb: [401], solid: "games", eztv: false };
    case "all":
    default:
      return { nyaa: "0_0", yts: true, tpb: [], solid: "all", eztv: true };
  }
}
