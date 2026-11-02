import { describe, expect, it } from "vitest";
import { findBrokenFormats } from "./find-broken-formats.ts";

describe(findBrokenFormats, () => {
  it("finds the time and named styles precompiled messages render wrong", () => {
    expect(
      findBrokenFormats(
        "{a, time} {b, time, short} {c, date, medium} {d, date, full} {e, number, percent}",
      ),
    ).toStrictEqual([
      "{a, time}",
      "{b, time, short}",
      "{c, date, medium}",
      "{d, date, full}",
      "{e, number, percent}",
    ]);
  });

  it("looks inside plurals, selects and tags", () => {
    expect(
      findBrokenFormats(
        "{n, plural, one {<b>{at, time}</b>} other {{kind, select, other {{share, number, percent}}}}}",
      ),
    ).toStrictEqual(["{at, time}", "{share, number, percent}"]);
  });

  it("leaves the formats that render right", () => {
    expect(
      findBrokenFormats(
        "{name} {count, number} {day, date} {n, plural, one {# day} other {# days}}",
      ),
    ).toStrictEqual([]);
  });
});
