import { describe, expect, it } from "vitest";
import {
  extractEpisodeNumber,
  fileMatchesEpisode,
  findBestFolder,
  foldName,
  normalizeAnimeTitle,
  parseFolderFiles,
  parseIndexFolders,
} from "./kitsu";

describe("normalizeAnimeTitle", () => {
  it.each([
    ["[SubsPlease] One Piece - 1177 (1080p) [1D212675].mkv", "one piece"],
    ["[Erai-raws] Frieren S01E05 [1080p][Multiple Subtitle]", "frieren"],
    ["One.Piece.EP1177.1080p.mp4", "one piece"],
    ["Naruto Shippuden - 500 (BD 1920x1080)", "naruto shippuden"],
  ])("normalizes %p -> %p", (raw, expected) => {
    expect(normalizeAnimeTitle(raw)).toBe(expected);
  });
});

describe("extractEpisodeNumber", () => {
  it.each([
    ["[SubsPlease] One Piece - 1177 (1080p)", "1177"],
    ["Show S01E05 720p", "05"],
    ["Anime EP23", "23"],
    ["Just A Title", undefined],
  ])("extracts %p -> %p", (raw, expected) => {
    expect(extractEpisodeNumber(raw as string)).toBe(expected);
  });
});

describe("findBestFolder", () => {
  const folders = ["Naruto", "Naruto Shippuuden", "One Piece", "One Piece Movies"];
  it("prefers exact, then prefix, then substring", () => {
    expect(findBestFolder(folders, "one piece")).toBe("One Piece");
    expect(findBestFolder(folders, "naruto")).toBe("Naruto");
    expect(findBestFolder(folders, "piece")).toBe("One Piece");
    expect(findBestFolder(folders, "bleach")).toBeUndefined();
    expect(findBestFolder(folders, "")).toBeUndefined();
  });

  it("folds separators", () => {
    expect(foldName("One_Piece.")).toBe("one piece");
  });
});

describe("parseIndexFolders", () => {
  it("decodes folder names once", () => {
    const html = `<a href="dirlist.php?dir=subtitles%2Fjapanese%2FOne%20Piece&x=1">x</a>
<a href="dirlist.php?dir=subtitles%2Fjapanese%2FNaruto&x=1">y</a>
<a href="dirlist.php?dir=subtitles%2Fjapanese%2FOne%20Piece&x=1">dup</a>`;
    expect(parseIndexFolders(html)).toEqual(["One Piece", "Naruto"]);
  });
});

describe("fileMatchesEpisode", () => {
  it("matches direct numbers, batch ranges, and avoids year collisions", () => {
    expect(fileMatchesEpisode("One Piece - 1177.srt", "1177")).toBe(true);
    expect(fileMatchesEpisode("Show.S21 (1100-1200).zip", "1177")).toBe(true);
    expect(fileMatchesEpisode("Show.S01 (0001-0130).zip", "1177")).toBe(false);
    expect(fileMatchesEpisode("Show (2021) complete.zip", "21")).toBe(false);
    expect(fileMatchesEpisode("Show - 23.mkv", "23")).toBe(true);
  });
});

describe("parseFolderFiles", () => {
  it("collects subtitle files, skips nav links", () => {
    const html = `<a href="dirlist.php?dir=subtitles%2Fjapanese">up</a>
<a href="One%20Piece%20-%201177.srt">One Piece - 1177.srt</a>
<a href="/subs/One Piece - 1178.ass">x</a>
<a href="cover.jpg">cover</a>`;
    const out = parseFolderFiles(html, "https://kitsunekko.net/dirlist.php?dir=x");
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("One Piece - 1177.srt");
    expect(out[0].url).toContain("One%20Piece%20-%201177.srt");
    expect(out[1].url).toBe("https://kitsunekko.net/subs/One%20Piece%20-%201178.ass");
  });

  it("handles anchors wrapping inner tags (live kitsunekko markup)", () => {
    const html = `<a href="subtitles/japanese/One_Piece/One%20Piece%20-%201177.zip" class=""><strong>One Piece - 1177.zip</strong> </a>`;
    const out = parseFolderFiles(html, "https://kitsunekko.net/dirlist.php?dir=y");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("One Piece - 1177.zip");
    expect(out[0].url).toBe(
      "https://kitsunekko.net/subtitles/japanese/One_Piece/One%20Piece%20-%201177.zip",
    );
  });
});
