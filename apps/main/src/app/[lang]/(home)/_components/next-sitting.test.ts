import { getIsoDay } from "@zoonk/utils/calendar-day";
import { describe, expect, it } from "vitest";
import { en } from "./example-sets/en";
import { getNextSitting } from "./next-sitting";

const sat = ["2026-11-07", "2026-12-05", "2027-03-06"] as const;

describe(getNextSitting, () => {
  it("picks the first listed sitting after today", () => {
    expect(getNextSitting({ sittings: sat, today: "2026-10-31" })).toBe("2026-11-07");
    expect(getNextSitting({ sittings: sat, today: "2026-11-07" })).toBe("2026-12-05");
    expect(getNextSitting({ sittings: sat, today: "2026-12-06" })).toBe("2027-03-06");
  });

  it("moves the last listed sitting to its weekday closest to the same date once the list runs out", () => {
    expect(getNextSitting({ sittings: sat, today: "2027-03-06" })).toBe("2028-03-04");
    expect(getNextSitting({ sittings: ["2026-05-30"], today: "2027-03-01" })).toBe("2027-05-29");
  });

  it("moves to next year once this year's sitting has come", () => {
    expect(getNextSitting({ sittings: ["2026-11-19"], today: "2026-11-19" })).toBe("2027-11-18");
    expect(getNextSitting({ sittings: ["2026-11-19"], today: "2028-12-01" })).toBe("2029-11-22");
  });

  it("counts today in the exam's zone, so the SAT's eve in New York still shows that sitting", () => {
    const now = new Date("2027-03-06T04:30:00Z");
    const today = getIsoDay({ now, timeZone: en.exam.timeZone });

    expect(getNextSitting({ sittings: en.exam.sittings, today })).toBe("2027-03-06");
  });
});
