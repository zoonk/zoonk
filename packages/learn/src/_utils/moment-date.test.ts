import { describe, expect, it } from "vitest";
import { getMomentDateOptions, getMomentDays } from "./moment-date";

describe(getMomentDays, () => {
  it("keeps two turns either side of UTC midnight on the device's one day", () => {
    const { dayOf, today } = getMomentDays({
      now: new Date("2026-11-28T01:00:00Z"),
      timeZone: "America/Sao_Paulo",
    });

    expect(dayOf("2026-11-27T23:30:00Z")).toBe("2026-11-27");
    expect(dayOf("2026-11-28T00:30:00Z")).toBe("2026-11-27");
    expect(today).toBe("2026-11-27");
  });

  it("splits turns that UTC puts on one day when the device's midnight falls between them", () => {
    const { dayOf, today } = getMomentDays({
      now: new Date("2026-12-31T12:00:00Z"),
      timeZone: "Pacific/Kiritimati",
    });

    expect(dayOf("2026-12-30T09:30:00Z")).toBe("2026-12-30");
    expect(dayOf("2026-12-30T11:00:00Z")).toBe("2026-12-31");
    expect(today).toBe("2027-01-01");
  });
});

describe(getMomentDateOptions, () => {
  const now = new Date("2026-12-31T12:00:00Z");
  const moment = "2026-12-31T08:00:00Z";

  it("shows the year of an instant from last year on the device's New Year's Day", () => {
    const options = getMomentDateOptions({
      clock: { now, timeZone: "Pacific/Kiritimati" },
      moment,
    });

    expect(options).toMatchObject({ timeZone: "Pacific/Kiritimati", year: "numeric" });
  });

  it("leaves the year out where the instant and today share one", () => {
    const options = getMomentDateOptions({ clock: { now, timeZone: "UTC" }, moment });

    expect(options.year).toBeUndefined();
  });
});
