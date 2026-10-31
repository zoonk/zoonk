import { describe, expect, it } from "vitest";
import { getStartOfLocalDay } from "./local-time";

describe(getStartOfLocalDay, () => {
  it("starts a day at its local midnight", () => {
    expect(
      getStartOfLocalDay({
        localDate: new Date("2026-03-10T00:00:00.000Z"),
        timeZone: "America/Sao_Paulo",
      }).toISOString(),
    ).toBe("2026-03-10T03:00:00.000Z");
  });

  it("starts a day after a daylight-saving change at its own midnight", () => {
    // New York springs forward at 02:00 on March 8: March 9 starts at midnight EDT.
    expect(
      getStartOfLocalDay({
        localDate: new Date("2026-03-09T00:00:00.000Z"),
        timeZone: "America/New_York",
      }).toISOString(),
    ).toBe("2026-03-09T04:00:00.000Z");
  });

  it("starts a day whose midnight the clocks skip at its first hour", () => {
    // Havana goes from March 7 23:59:59 straight to March 8 01:00 (UTC−4).
    expect(
      getStartOfLocalDay({
        localDate: new Date("2026-03-08T00:00:00.000Z"),
        timeZone: "America/Havana",
      }).toISOString(),
    ).toBe("2026-03-08T05:00:00.000Z");
  });

  it("starts a day whose midnight the clocks repeat at its first midnight", () => {
    // Vostok went from 02:00 (UTC+7) back to 00:00 (UTC+5) on December 18, 2023.
    expect(
      getStartOfLocalDay({
        localDate: new Date("2023-12-18T00:00:00.000Z"),
        timeZone: "Antarctica/Vostok",
      }).toISOString(),
    ).toBe("2023-12-17T17:00:00.000Z");
  });

  it("starts a day the clocks go back across at its first midnight, not its second", () => {
    // Casey's March 5, 2010 began at 13:00Z (UTC+11); at 15:00Z it went back to March 4 23:00 (UTC+8).
    expect(
      getStartOfLocalDay({
        localDate: new Date("2010-03-05T00:00:00.000Z"),
        timeZone: "Antarctica/Casey",
      }).toISOString(),
    ).toBe("2010-03-04T13:00:00.000Z");
  });

  it("starts a day to the second when its offset isn't whole minutes", () => {
    // Monrovia went from UTC−00:44:30 to UTC on January 7, 1972: that day began at 00:44:30Z.
    expect(
      getStartOfLocalDay({
        localDate: new Date("1972-01-07T00:00:00.000Z"),
        timeZone: "Africa/Monrovia",
      }).toISOString(),
    ).toBe("1972-01-07T00:44:30.000Z");
  });
});
