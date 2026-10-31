import { describe, expect, it } from "vitest";
import { getNextSitting } from "./next-sitting";

describe(getNextSitting, () => {
  it("keeps a sitting still ahead", () => {
    expect(getNextSitting({ day: "2027-06-14", today: "2026-10-31" })).toBe("2027-06-14");
  });

  it("moves a past sitting to its weekday closest to the same date this year", () => {
    expect(getNextSitting({ day: "2026-05-30", today: "2027-03-01" })).toBe("2027-05-29");
  });

  it("moves to next year once this year's sitting has come", () => {
    expect(getNextSitting({ day: "2026-11-19", today: "2026-11-19" })).toBe("2027-11-18");
    expect(getNextSitting({ day: "2026-11-19", today: "2028-12-01" })).toBe("2029-11-22");
  });
});
