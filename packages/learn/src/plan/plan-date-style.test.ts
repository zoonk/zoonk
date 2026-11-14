import { describe, expect, it } from "vitest";
import { getPlanDateStyle } from "./plan-date-style";

const today = "2026-11-14";

describe(getPlanDateStyle, () => {
  it("names the year of the same day a year ahead, so it doesn't read as today", () => {
    expect(getPlanDateStyle({ isoDate: "2027-11-14", today })).toBe("dayYear");
  });

  it("names the year of a day early next year", () => {
    expect(getPlanDateStyle({ isoDate: "2027-01-24", today })).toBe("dayYear");
  });

  it("leaves the year out of a day later this year", () => {
    expect(getPlanDateStyle({ isoDate: "2026-12-14", today })).toBe("day");
  });

  it("names the year of a day last year", () => {
    expect(getPlanDateStyle({ isoDate: "2025-11-14", today })).toBe("dayYear");
  });

  it("says an estimate this year by its month", () => {
    expect(getPlanDateStyle({ isoDate: "2026-12-02", month: true, today })).toBe("month");
  });

  it("says an estimate in another year by its month and year", () => {
    expect(getPlanDateStyle({ isoDate: "2027-03-02", month: true, today })).toBe("monthYear");
  });
});
