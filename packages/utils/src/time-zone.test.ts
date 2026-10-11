import { describe, expect, it } from "vitest";
import {
  getDateInTimeZone,
  getHourInTimeZone,
  getTimeZoneOffsetMs,
  isValidTimeZone,
} from "./time-zone";

describe(isValidTimeZone, () => {
  it.each(["UTC", "America/Los_Angeles", "Pacific/Kiritimati"])(
    "accepts IANA timezone %s",
    (timeZone) => {
      expect(isValidTimeZone(timeZone)).toBe(true);
    },
  );

  it.each(["", "GMT+25", "not/a-timezone"])("rejects invalid timezone %s", (timeZone) => {
    expect(isValidTimeZone(timeZone)).toBe(false);
  });
});

describe(getDateInTimeZone, () => {
  it.each([
    {
      expected: "2026-07-13T00:00:00.000Z",
      now: "2026-07-12T12:00:00.000Z",
      timeZone: "Pacific/Kiritimati",
    },
    {
      expected: "2026-07-11T00:00:00.000Z",
      now: "2026-07-12T02:00:00.000Z",
      timeZone: "America/Los_Angeles",
    },
  ])("returns the UTC date label for $timeZone", ({ expected, now, timeZone }) => {
    expect(getDateInTimeZone({ date: new Date(now), timeZone })).toStrictEqual(new Date(expected));
  });
});

describe(getHourInTimeZone, () => {
  it.each([
    { expected: 0, now: "2026-07-12T00:30:00.000Z", timeZone: "UTC" },
    { expected: 19, now: "2026-07-12T02:00:00.000Z", timeZone: "America/Los_Angeles" },
    { expected: 2, now: "2026-07-12T12:00:00.000Z", timeZone: "Pacific/Kiritimati" },
    { expected: 23, now: "2026-03-02T02:59:00.000Z", timeZone: "America/Sao_Paulo" },
  ])("returns the local hour in $timeZone", ({ expected, now, timeZone }) => {
    expect(getHourInTimeZone({ date: new Date(now), timeZone })).toBe(expected);
  });
});

describe(getTimeZoneOffsetMs, () => {
  const HOUR = 3_600_000;

  it.each([
    { expected: -3 * HOUR, now: "2026-07-12T12:00:00.000Z", timeZone: "America/Sao_Paulo" },
    { expected: 9 * HOUR, now: "2026-07-12T12:00:00.000Z", timeZone: "Asia/Tokyo" },
    { expected: HOUR, now: "2026-07-12T12:00:00.000Z", timeZone: "Europe/Lisbon" },
    { expected: 0, now: "2026-01-12T12:00:00.000Z", timeZone: "Europe/Lisbon" },
  ])("reads how far $timeZone is ahead of UTC on $now", ({ expected, now, timeZone }) => {
    expect(getTimeZoneOffsetMs({ date: new Date(now), timeZone })).toBe(expected);
  });
});
