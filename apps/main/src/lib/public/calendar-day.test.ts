import { describe, expect, it } from "vitest";
import { addIsoDays, daysBetweenIsoDays, getIsoDay, getSecondsToMidnight } from "./calendar-day";

const LATE_IN_BRAZIL = new Date("2026-10-14T01:30:00Z");

describe(getIsoDay, () => {
  it("reads the day on the time zone's own calendar", () => {
    expect(getIsoDay({ now: LATE_IN_BRAZIL, timeZone: "UTC" })).toBe("2026-10-14");
    expect(getIsoDay({ now: LATE_IN_BRAZIL, timeZone: "America/Sao_Paulo" })).toBe("2026-10-13");
  });
});

describe(getSecondsToMidnight, () => {
  it("counts to the time zone's next midnight", () => {
    expect(getSecondsToMidnight({ now: LATE_IN_BRAZIL, timeZone: "UTC" })).toBe(22.5 * 3600);

    expect(getSecondsToMidnight({ now: LATE_IN_BRAZIL, timeZone: "America/Sao_Paulo" })).toBe(
      1.5 * 3600,
    );
  });

  it("counts to the next day's own midnight across a daylight saving change", () => {
    // Paris moves its clocks forward on March 29, 2026: that night's midnight is at 22:00 UTC.
    expect(
      getSecondsToMidnight({ now: new Date("2026-03-29T00:15:00Z"), timeZone: "Europe/Paris" }),
    ).toBe(78_300);

    // And back on October 25, 2026: that night's midnight is at 23:00 UTC.
    expect(
      getSecondsToMidnight({ now: new Date("2026-10-25T00:15:00Z"), timeZone: "Europe/Paris" }),
    ).toBe(81_900);
  });

  it("starts the next day when the clock lands, in a zone that skips its midnight", () => {
    // Havana jumps from 23:59:59 to 01:00 on March 8, 2026: the day starts at 05:00 UTC.
    expect(
      getSecondsToMidnight({ now: new Date("2026-03-08T04:30:00Z"), timeZone: "America/Havana" }),
    ).toBe(1800);

    // Santiago does the same on September 6, 2026: the day starts at 04:00 UTC.
    expect(
      getSecondsToMidnight({ now: new Date("2026-09-06T02:30:00Z"), timeZone: "America/Santiago" }),
    ).toBe(5400);
  });

  it("gives a whole day at midnight itself", () => {
    expect(getSecondsToMidnight({ now: new Date("2026-10-14T00:00:00Z"), timeZone: "UTC" })).toBe(
      86_400,
    );
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
