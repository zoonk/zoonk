import { describe, expect, it } from "vitest";
import { getSeriesMark } from "./series-marks";

const marks = Array.from({ length: 30 }, (_, index) => getSeriesMark(index));

describe(getSeriesMark, () => {
  it("gives the first six series a color each, drawn solid", () => {
    const six = marks.slice(0, 6);

    expect(new Set(six.map((mark) => mark.tone)).size).toBe(6);
    expect(six.every((mark) => !mark.open)).toBe(true);
  });

  it("draws a repeated color open, so two bars of one color never look the same", () => {
    const looks = marks.slice(0, 12).map((mark) => `${mark.tone} ${String(mark.open)}`);

    expect(new Set(looks).size).toBe(12);
  });

  it("never pairs a color with the same point shape twice, so 30 lines stay apart", () => {
    const looks = marks.map((mark) => `${mark.tone} ${mark.shape}`);

    expect(new Set(looks).size).toBe(30);
  });
});
