import { describe, expect, it } from "vitest";
import {
  buildMagnet,
  parseNyaaRss,
  parseSizeToBytes,
  parseYtsResponse,
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
    expect(r.publishedAt).toBe(new Date(1725148800 * 1000).toISOString());
  });

  it("returns [] when no movies", () => {
    expect(parseYtsResponse({ data: { movie_count: 0 } })).toEqual([]);
    expect(parseYtsResponse({})).toEqual([]);
  });
});
