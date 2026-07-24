import { describe, expect, it } from "vitest";
import { getScoreDateRange } from "./score-date-range";

describe(getScoreDateRange, () => {
  it("returns exactly 90 local dates and matching instants ahead of UTC", () => {
    const range = getScoreDateRange({
      now: new Date("2026-07-23T12:30:00.000Z"),
      timeZone: "Pacific/Kiritimati",
    });

    expect(range).toStrictEqual({
      dailyProgress: {
        endDate: new Date("2026-07-24T00:00:00.000Z"),
        startDate: new Date("2026-04-26T00:00:00.000Z"),
      },
      stepAttempts: {
        endDate: new Date("2026-07-23T12:30:00.000Z"),
        startDate: new Date("2026-04-25T10:00:00.000Z"),
      },
    });
  });

  it("uses the western local date and preserves DST-specific instant boundaries", () => {
    const range = getScoreDateRange({
      now: new Date("2026-03-15T02:30:00.000Z"),
      timeZone: "America/Los_Angeles",
    });

    expect(range).toStrictEqual({
      dailyProgress: {
        endDate: new Date("2026-03-14T00:00:00.000Z"),
        startDate: new Date("2025-12-15T00:00:00.000Z"),
      },
      stepAttempts: {
        endDate: new Date("2026-03-15T02:30:00.000Z"),
        startDate: new Date("2025-12-15T08:00:00.000Z"),
      },
    });
  });

  it("starts at the earliest valid instant when a timezone skips midnight", () => {
    const range = getScoreDateRange({
      now: new Date("2026-12-04T12:00:00.000Z"),
      timeZone: "America/Santiago",
    });

    expect(range.stepAttempts.startDate).toStrictEqual(new Date("2026-09-06T04:00:00.000Z"));
  });
});
