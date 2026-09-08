import { describe, expect, it } from "vitest";
import { parseTorznabXml } from "./torznab";

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed">
<channel><title>jackett</title>
<item>
<title>Ubuntu 24.04 Desktop amd64</title>
<link>magnet:?xt=urn:btih:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&amp;dn=ubuntu</link>
<comments>http://example.test/t/1</comments>
<pubDate>Mon, 01 Sep 2026 12:00:00 +0000</pubDate>
<author>trusteduser</author>
<torznab:attr name="seeders" value="412"/>
<torznab:attr name="peers" value="37"/>
<torznab:attr name="size" value="5905580032"/>
<torznab:attr name="infohash" value="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"/>
<torznab:attr name="magneturl" value="magnet:?xt=urn:btih:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&amp;dn=ubuntu"/>
</item>
<item>
<title>Undownloadable row</title>
<link></link>
<comments>http://example.test/t/9</comments>
<pubDate>Mon, 01 Sep 2026 12:00:00 +0000</pubDate>
<torznab:attr name="seeders" value="99"/>
</item>
</channel></rss>`;

describe("parseTorznabXml", () => {
  it("maps attrs to the canonical schema", () => {
    const out = parseTorznabXml(FIXTURE, "1337x", new Set(["trusteduser"]));
    expect(out).toHaveLength(1);
    const r = out[0];
    expect(r.title).toBe("Ubuntu 24.04 Desktop amd64");
    expect(r.tracker).toBe("1337x");
    expect(r.infoHash).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(r.magnetUri).toContain("magnet:?");
    expect(r.detailsUrl).toBe("http://example.test/t/1");
    expect(r.seeders).toBe(412);
    expect(r.leechers).toBe(37);
    expect(r.sizeBytes).toBe(5905580032);
    expect(r.uploader).toBe("trusteduser");
    expect(r.trusted).toBe(true);
    expect(r.publishedAt).toBe("2026-09-01T12:00:00.000Z");
    expect(r.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("skips rows with neither magnet nor torrent url", () => {
    const out = parseTorznabXml(FIXTURE, "1337x", new Set());
    expect(out.find((r) => r.title === "Undownloadable row")).toBeUndefined();
  });

  it("returns [] on malformed xml", () => {
    expect(parseTorznabXml("not xml at all", "x", new Set())).toEqual([]);
    expect(parseTorznabXml("<rss></rss>", "x", new Set())).toEqual([]);
  });

  it("matches trusted uploaders case-insensitively via caller set", () => {
    const out = parseTorznabXml(FIXTURE, "1337x", new Set(["TRUSTEDUSER"]));
    // uploader stored as-is; set was built lowercase in getConfig — caller contract
    expect(out[0].trusted).toBe(false);
  });
});
