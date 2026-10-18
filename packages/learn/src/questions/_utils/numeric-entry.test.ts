import { describe, expect, it } from "vitest";
import { parseEntryAnswer } from "./numeric-entry";

const FRACTION = { kind: "fraction", places: null } as const;
const INTEGER = { kind: "integer", places: null } as const;

describe(parseEntryAnswer, () => {
  it("takes a fraction as its value, in a fraction box only", () => {
    expect(parseEntryAnswer({ entry: FRACTION, locale: "en", text: "2/3" })).toBeCloseTo(2 / 3);
    expect(parseEntryAnswer({ entry: FRACTION, locale: "pt", text: " -1,5 / 4 " })).toBe(-0.375);
    expect(parseEntryAnswer({ entry: FRACTION, locale: "en", text: ".667" })).toBe(0.667);
    expect(parseEntryAnswer({ entry: null, locale: "en", text: "2/3" })).toBeNull();
  });

  it("takes no fraction over zero or with more than one slash", () => {
    expect(parseEntryAnswer({ entry: FRACTION, locale: "en", text: "2/0" })).toBeNull();
    expect(parseEntryAnswer({ entry: FRACTION, locale: "en", text: "1/2/3" })).toBeNull();
  });

  it("takes only a whole number in an integer box", () => {
    expect(parseEntryAnswer({ entry: INTEGER, locale: "en", text: "12" })).toBe(12);
    expect(parseEntryAnswer({ entry: INTEGER, locale: "pt", text: "12,5" })).toBeNull();
  });

  it("reads any other box's number the way the learner's language writes it", () => {
    expect(parseEntryAnswer({ entry: null, locale: "pt", text: "2,5" })).toBe(2.5);

    expect(
      parseEntryAnswer({ entry: { kind: "decimals", places: 2 }, locale: "en", text: "3.14" }),
    ).toBe(3.14);
  });
});
