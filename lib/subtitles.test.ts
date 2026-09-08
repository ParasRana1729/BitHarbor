import { describe, expect, it } from "vitest";
import {
  firstImdbFromYts,
  parseMovieTitle,
  parseSubtitleRows,
} from "./subtitles";

const MOVIE_HTML = `<html><head><title>The Matrix YIFY subtitles</title></head><body>
<table class="table other-subs"><tbody>
<tr data-id="119081">
<td class="rating-cell"><span class="label label-success">2</span></td>
<td class="flag-cell"><span class="flag flag-sa"></span><span class="sub-lang">Arabic</span></td>
<td><a href="/subtitles/the-matrix-1999-arabic-yify-119081"><span class="text-muted">subtitle</span> The Matrix</a></td>
<td class="other-cell"></td>
<td class="uploader-cell"><a href="/user/Nader">Nader</a></td>
</tr>
<tr data-id="555">
<td class="rating-cell"><span class="label">9</span></td>
<td class="flag-cell"><span class="sub-lang">English</span></td>
<td><a href="/subtitles/the-matrix-1999-english-yify-555">The Matrix 1080p YIFY</a></td>
<td class="other-cell"></td>
<td class="uploader-cell"><a href="/user/X">X</a></td>
</tr>
</tbody></table></body></html>`;

describe("parseSubtitleRows", () => {
  it("extracts rows with zip urls, sorted by rating desc", () => {
    const out = parseSubtitleRows(MOVIE_HTML);
    expect(out).toHaveLength(2);
    expect(out[0].language).toBe("English");
    expect(out[0].rating).toBe(9);
    expect(out[0].downloadUrl).toBe(
      "https://yifysubtitles.ch/subtitle/the-matrix-1999-english-yify-555.zip",
    );
    expect(out[0].pageUrl).toBe(
      "https://yifysubtitles.ch/subtitles/the-matrix-1999-english-yify-555",
    );
    expect(out[0].uploader).toBe("X");
    expect(out[0].release).toBe("The Matrix 1080p YIFY");
    expect(out[1].language).toBe("Arabic");
    expect(out[1].release).toBe("The Matrix");
  });

  it("returns [] on garbage", () => {
    expect(parseSubtitleRows("nope")).toEqual([]);
  });
});

describe("parseMovieTitle", () => {
  it("strips the site suffix", () => {
    expect(parseMovieTitle(MOVIE_HTML)).toBe("The Matrix");
  });
});

describe("firstImdbFromYts", () => {
  it("returns the first usable imdb code", () => {
    const json = {
      data: {
        movies: [{ imdb_code: "" }, { imdb_code: "tt0133093" }],
      },
    };
    expect(firstImdbFromYts(json)).toBe("tt0133093");
    expect(firstImdbFromYts({ data: {} })).toBeUndefined();
    expect(firstImdbFromYts({})).toBeUndefined();
  });
});
