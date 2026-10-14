import { describe, expect, it } from "vitest";
import { getPlanDateStyle } from "./plan-date-style";

const today = "2026-10-12";

describe(getPlanDateStyle, () => {
  it("leaves the year out of a day in the next twelve months", () => {
    expect(getPlanDateStyle({ isoDate: "2027-01-24", today })).toBe("day");
  });

  it("names the year of a day further away", () => {
    expect(getPlanDateStyle({ isoDate: "2027-11-14", today })).toBe("dayYear");
  });

  it("names the year of a day long past", () => {
    expect(getPlanDateStyle({ isoDate: "2025-09-01", today })).toBe("dayYear");
  });

  it("says a near estimate by its month", () => {
    expect(getPlanDateStyle({ isoDate: "2027-03-02", month: true, today })).toBe("month");
  });

  it("says a far estimate by its month and year", () => {
    expect(getPlanDateStyle({ isoDate: "2028-03-02", month: true, today })).toBe("monthYear");
  });
});
