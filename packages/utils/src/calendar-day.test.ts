import { describe, expect, it } from "vitest";
import { addIsoDays, daysBetweenIsoDays, getIsoDay, isInAnotherYear } from "./calendar-day";

const LATE_IN_BRAZIL = new Date("2026-10-14T01:30:00Z");

describe(getIsoDay, () => {
  it("reads the day on the time zone's own calendar", () => {
    expect(getIsoDay({ now: LATE_IN_BRAZIL, timeZone: "UTC" })).toBe("2026-10-14");
    expect(getIsoDay({ now: LATE_IN_BRAZIL, timeZone: "America/Sao_Paulo" })).toBe("2026-10-13");
  });
});

describe(daysBetweenIsoDays, () => {
  it("counts whole days either way", () => {
    expect(daysBetweenIsoDays({ from: "2026-10-13", to: "2026-11-08" })).toBe(26);
    expect(daysBetweenIsoDays({ from: "2026-11-08", to: "2026-10-13" })).toBe(-26);
  });
});

describe(addIsoDays, () => {
  it("moves across months and years", () => {
    expect(addIsoDays({ day: "2026-10-13", days: 151 })).toBe("2027-03-13");
    expect(addIsoDays({ day: "2026-10-13", days: -15 })).toBe("2026-09-28");
  });
});

describe(isInAnotherYear, () => {
  const today = "2026-11-14";

  it("names the year of the same day a year ahead, and of a day last year", () => {
    expect(isInAnotherYear({ isoDate: "2027-11-14", today })).toBe(true);
    expect(isInAnotherYear({ isoDate: "2025-11-14", today })).toBe(true);
  });

  it("leaves it out for a day later this year", () => {
    expect(isInAnotherYear({ isoDate: "2026-12-14", today })).toBe(false);
  });
});
