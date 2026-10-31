import { describe, expect, it } from "vitest";
import { getMissedDayChange } from "./missed-day";

const day = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`);

describe(getMissedDayChange, () => {
  it("moves the phase's end a day later while the date leaves room", () => {
    expect(getMissedDayChange({ date: day("2026-11-08"), end: day("2026-10-23") })).toStrictEqual({
      kind: "moved",
      movedEnd: day("2026-10-24"),
    });
  });

  it("never moves it past the goal's date: a lesson is left out instead", () => {
    expect(getMissedDayChange({ date: day("2026-11-08"), end: day("2026-11-08") })).toStrictEqual({
      kind: "leftOut",
    });
  });
});
