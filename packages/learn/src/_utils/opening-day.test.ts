import { describe, expect, it } from "vitest";
import { toOpeningDay } from "./opening-day";

describe(toOpeningDay, () => {
  const now = new Date("2026-11-13T23:30:00.000Z");

  it("names the day in the learner's time zone, not the server's", () => {
    const availableAt = "2026-11-14T01:00:00.000Z";

    expect(toOpeningDay({ availableAt, now, timeZone: "UTC" })).toBe("tomorrow");
    expect(toOpeningDay({ availableAt, now, timeZone: "America/Sao_Paulo" })).toBe("today");
  });

  it("gives a later day as its date", () => {
    expect(
      toOpeningDay({ availableAt: "2026-11-20T12:00:00.000Z", now, timeZone: "Asia/Tokyo" }),
    ).toBe("2026-11-20");

    expect(
      toOpeningDay({ availableAt: "2026-11-20T23:00:00.000Z", now, timeZone: "Asia/Tokyo" }),
    ).toBe("2026-11-21");
  });

  it("reads an instant already past as today, and one it can't read as nothing", () => {
    expect(toOpeningDay({ availableAt: "2026-11-01T00:00:00.000Z", now, timeZone: "UTC" })).toBe(
      "today",
    );

    expect(toOpeningDay({ availableAt: "soon", now, timeZone: "UTC" })).toBeNull();
    expect(toOpeningDay({ availableAt: null, now, timeZone: "UTC" })).toBeNull();
  });
});
