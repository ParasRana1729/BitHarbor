import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  buildMagnet,
  imdbsFromTvmaze,
  normalizeImdbId,
  parseApibayResponse,
  parseEztvResponse,
  parseNyaaRss,
  parseSizeToBytes,
  parseSolidResponse,
  parseYtsResponse,
  searchProviders,
} from "./providers";

const NYAA_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:nyaa="https://nyaa.si/xmlns/nyaa" version="2.0">
<channel><title>Nyaa</title>
<item>
<title>[SubsPlease] One Piece - 1090 (1080p)</title>
<link>https://nyaa.si/download/12345.torrent</link>
<guid isPermaLink="true">https://nyaa.si/view/12345</guid>
<pubDate>Mon, 01 Sep 2026 12:00:00 -0000</pubDate>
<nyaa:seeders>120</nyaa:seeders>
<nyaa:leechers>8</nyaa:leechers>
<nyaa:downloads>500</nyaa:downloads>
<nyaa:infoHash>AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA</nyaa:infoHash>
<nyaa:categoryId>1_2</nyaa:categoryId>
<nyaa:category>Anime - English-translated</nyaa:category>
<nyaa:size>1.4 GiB</nyaa:size>
<nyaa:comments>3</nyaa:comments>
<nyaa:trusted>Yes</nyaa:trusted>
<nyaa:remake>No</nyaa:remake>
</item>
<item>
<title>Some 0-seed thing</title>
<link>https://nyaa.si/download/999.torrent</link>
<guid isPermaLink="true">https://nyaa.si/view/999</guid>
<pubDate>Mon, 01 Sep 2026 12:00:00 -0000</pubDate>
<nyaa:seeders>0</nyaa:seeders>
<nyaa:leechers>0</nyaa:leechers>
<nyaa:infoHash>BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB</nyaa:infoHash>
<nyaa:size>700 MiB</nyaa:size>
<nyaa:trusted>No</nyaa:trusted>
</item>
</channel></rss>`;

const YTS_FIXTURE = {
  status: "ok",
  data: {
    movie_count: 1,
    movies: [
      {
        title_long: "Dune (2021)",
        imdb_code: "tt1160419",
        url: "https://yts.gg/movies/dune-2021",
        torrents: [
          {
            url: "https://yts.gg/torrent/download/AAA",
            hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            quality: "1080p",
            type: "bluray",
            seeds: 900,
            peers: 100,
            size: "2.5 GB",
            size_bytes: 2684354560,
            date_uploaded_unix: 1725148800,
          },
          {
            url: "https://yts.gg/torrent/download/BBB",
            hash: "",
            quality: "720p",
            seeds: 10,
            peers: 1,
          },
        ],
      },
    ],
  },
};

describe("parseSizeToBytes", () => {
  it.each([
    ["1.4 GiB", 1503238553],
    ["700 MiB", 734003200],
    ["2.5 GB", 2684354560],
    ["123 B", 123],
    ["1 KB", 1024],
    ["", 0],
    ["nonsense", 0],
    [undefined, 0],
  ])("parses %p -> %p", (raw, expected) => {
    expect(parseSizeToBytes(raw as string | undefined)).toBe(expected);
  });
});

describe("buildMagnet", () => {
  it("builds a magnet with lowercase hash, encoded name and trackers", () => {
    const m = buildMagnet("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "My Movie [1080p]");
    expect(m.startsWith("magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
    expect(m).toContain("dn=My%20Movie%20%5B1080p%5D");
    expect(m).toContain("tr=");
  });
});

describe("parseNyaaRss", () => {
  it("maps feed items incl. trusted flag and generated magnet", () => {
    const out = parseNyaaRss(NYAA_FIXTURE);
    expect(out).toHaveLength(2);
    const r = out[0];
    expect(r.tracker).toBe("nyaa");
    expect(r.title).toContain("One Piece");
    expect(r.torrentUrl).toBe("https://nyaa.si/download/12345.torrent");
    expect(r.detailsUrl).toBe("https://nyaa.si/view/12345");
    expect(r.infoHash).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(r.magnetUri).toContain("magnet:?");
    expect(r.seeders).toBe(120);
    expect(r.leechers).toBe(8);
    expect(r.sizeBytes).toBe(1503238553);
    expect(r.trusted).toBe(true);
    expect(out[1].trusted).toBe(false);
    expect(out[1].sizeBytes).toBe(734003200);
  });

  it("returns [] on malformed xml", () => {
    expect(parseNyaaRss("garbage")).toEqual([]);
  });
});

describe("normalizeImdbId", () => {
  it.each([
    ["tt0133093", "tt0133093"],
    ["https://www.imdb.com/title/tt0133093/", "tt0133093"],
    ["", undefined],
    ["nonsense", undefined],
    ["0418372", "tt0418372"],
    [undefined, undefined],
    [42, undefined],
  ])("normalizes %p -> %p", (raw, expected) => {
    expect(normalizeImdbId(raw)).toBe(expected);
  });
});

describe("parseApibayResponse", () => {
  const rows = [
    {
      id: "7349687",
      name: "The Matrix (1999) 1080p BrRip x264 - YIFY",
      info_hash: "D7A46713EAEE18C746B3254B7D1492A50FD9D6CE",
      leechers: "124",
      seeders: "858",
      size: "1992277407",
      username: "YIFY",
      added: "1339543961",
      status: "vip",
      category: "207",
      imdb: "tt0133093",
    },
    {
      name: "No results returned",
      info_hash: "0000000000000000000000000000000000000000",
      leechers: "0",
      seeders: "0",
      size: "0",
      category: "0",
    },
  ];

  it("maps rows, skips the zero-hash placeholder", () => {
    const out = parseApibayResponse(rows);
    expect(out).toHaveLength(1);
    const r = out[0];
    expect(r.tracker).toBe("tpb");
    expect(r.title).toContain("The Matrix");
    expect(r.infoHash).toBe("d7a46713eaee18c746b3254b7d1492a50fd9d6ce");
    expect(r.magnetUri).toContain("magnet:?");
    expect(r.detailsUrl).toBe("https://thepiratebay.org/description.php?id=7349687");
    expect(r.seeders).toBe(858);
    expect(r.leechers).toBe(124);
    expect(r.sizeBytes).toBe(1992277407);
    expect(r.uploader).toBe("YIFY");
    expect(r.trusted).toBe(true);
    expect(r.imdbId).toBe("tt0133093");
    expect(r.publishedAt).toBe(new Date(1339543961 * 1000).toISOString());
  });

  it("marks non-vip uploaders untrusted", () => {
    const out = parseApibayResponse([{ ...rows[0], status: "member" }]);
    expect(out[0].trusted).toBe(false);
  });

  it("returns [] for non-arrays", () => {
    expect(parseApibayResponse({})).toEqual([]);
  });
});

describe("parseYtsResponse", () => {
  it("emits one result per torrent with hash, skips hashless", () => {
    const out = parseYtsResponse(YTS_FIXTURE);
    expect(out).toHaveLength(1);
    const r = out[0];
    expect(r.tracker).toBe("yts");
    expect(r.title).toBe("Dune (2021) [1080p]");
    expect(r.infoHash).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(r.magnetUri).toContain("magnet:?");
    expect(r.torrentUrl).toBe("https://yts.gg/torrent/download/AAA");
    expect(r.detailsUrl).toBe("https://yts.gg/movies/dune-2021");
    expect(r.seeders).toBe(900);
    expect(r.trusted).toBe(true);
    expect(r.uploader).toBe("YTS");
    expect(r.imdbId).toBe("tt1160419");
    expect(r.publishedAt).toBe(new Date(1725148800 * 1000).toISOString());
  });

  it("returns [] when no movies", () => {
    expect(parseYtsResponse({ data: { movie_count: 0 } })).toEqual([]);
    expect(parseYtsResponse({})).toEqual([]);
  });
});

describe("parseSolidResponse", () => {
  it("maps dht results, honors verified, skips zero hashes", () => {
    const out = parseSolidResponse({
      results: [
        {
          title: "Dune (2021)",
          infohash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          seeders: 50,
          leechers: 5,
          size: 2000000000,
          verified: true,
          updatedAt: 1725148800,
          downloads: 10,
        },
        { title: "junk", infohash: "0000000000000000000000000000000000000000" },
      ],
    });
    expect(out).toHaveLength(1);
    const r = out[0];
    expect(r.tracker).toBe("solid");
    expect(r.magnetUri).toContain("magnet:?");
    expect(r.trusted).toBe(true);
    expect(r.publishedAt).toBe(new Date(1725148800 * 1000).toISOString());
    expect(r.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("accepts ISO dates and untrusted rows", () => {
    const out = parseSolidResponse({
      results: [
        {
          title: "x",
          infohash: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
          verified: false,
          updatedAt: "2026-01-02T03:04:05.000Z",
        },
      ],
    });
    expect(out[0].trusted).toBe(false);
    expect(out[0].publishedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("returns [] for non-objects", () => {
    expect(parseSolidResponse({})).toEqual([]);
  });
});

describe("imdbsFromTvmaze", () => {
  it("extracts imdb ids best-first, deduped, capped", () => {
    const json = [
      { show: { externals: { imdb: "tt0903747" } } },
      { show: { externals: { imdb: null } } },
      { show: { externals: { imdb: "tt0903747" } } },
      { show: { externals: { imdb: "tt1234567" } } },
      { show: { externals: { imdb: "tt7654321" } } },
    ];
    expect(imdbsFromTvmaze(json)).toEqual(["tt0903747", "tt1234567"]);
    expect(imdbsFromTvmaze([])).toEqual([]);
  });
});

describe("parseEztvResponse", () => {
  it("maps episode torrents with ez magnets and bare imdb ids", () => {
    const out = parseEztvResponse(
      {
        torrents: [
          {
            hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            filename: "Show S01E02 720p HDTV x264-EZTV",
            magnet_url: "magnet:?xt=urn:btih:AAAA&dn=show",
            imdb_id: "0418372",
            seeds: 14,
            peers: 8,
            size_bytes: "819412418",
            date_released_unix: 1788872774,
          },
          { hash: "0000000000000000000000000000000000000000" },
        ],
      },
      "tt0418372",
    );
    expect(out).toHaveLength(1);
    const r = out[0];
    expect(r.tracker).toBe("eztv");
    expect(r.title).toContain("S01E02");
    expect(r.magnetUri).toContain("magnet:?");
    expect(r.imdbId).toBe("tt0418372");
    expect(r.uploader).toBe("EZTV");
    expect(r.trusted).toBe(true);
    expect(r.seeders).toBe(14);
  });

  it("falls back to the queried imdb when rows lack one", () => {
    const out = parseEztvResponse(
      { torrents: [{ hash: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" }] },
      "tt0903747",
    );
    expect(out[0].imdbId).toBe("tt0903747");
  });
});

describe("searchProviders resilience", () => {
  const YTS_MIN = {
    data: {
      movies: [
        {
          title_long: "Dune (2021)",
          imdb_code: "tt1160419",
          url: "https://yts.gg/movies/dune-2021",
          torrents: [{ hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", quality: "1080p", seeds: 5 }],
        },
      ],
    },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("survives one provider going down", async () => {
    vi.stubGlobal("fetch", async (url: unknown) => {
      const u = String(url);
      if (u.includes("nyaa.si")) throw new Error("nyaa down");
      if (u.includes("movies-api")) {
        return new Response(JSON.stringify(YTS_MIN), { status: 200 });
      }
      throw new Error(`unexpected ${u}`);
    });
    const out = await searchProviders("dune", ["nyaa", "yts"], 5000, "movies");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.tracker === "yts")).toBe(true);
  });

  it("treats hung providers as empty via timeout, not errors", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const out = await searchProviders("dune", ["nyaa", "yts"], 100, "movies");
    expect(out).toEqual([]);
  });
});
