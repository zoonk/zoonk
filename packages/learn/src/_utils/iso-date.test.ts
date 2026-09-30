import { describe, expect, it } from "vitest";
import { daysUntilIsoDate } from "./iso-date";

describe(daysUntilIsoDate, () => {
  it("counts whole days from the viewer's calendar day, whatever the time of day", () => {
    // Local times: late evening and early morning of the same calendar day count the same.
    const lateEvening = new Date(2026, 8, 28, 23, 30);
    const earlyMorning = new Date(2026, 8, 28, 0, 15);

    expect(daysUntilIsoDate({ isoDate: "2026-09-30", today: lateEvening })).toBe(2);
    expect(daysUntilIsoDate({ isoDate: "2026-09-30", today: earlyMorning })).toBe(2);
    expect(daysUntilIsoDate({ isoDate: "2026-11-08", today: earlyMorning })).toBe(41);
  });

  it("never counts below zero for today or a day already past", () => {
    const today = new Date(2026, 8, 28, 12, 0);

    expect(daysUntilIsoDate({ isoDate: "2026-09-28", today })).toBe(0);
    expect(daysUntilIsoDate({ isoDate: "2026-09-01", today })).toBe(0);
  });
});
