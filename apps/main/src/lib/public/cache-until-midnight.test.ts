import { cacheLife } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheUntilMidnight } from "./cache-until-midnight";

const HOUR = 3600;
const DAY = 24 * HOUR;

describe(cacheUntilMidnight, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("works a day's cache out again every hour, and keeps it a day past midnight", () => {
    // 01:30 UTC: 22.5 hours to midnight.
    vi.setSystemTime(new Date("2026-10-14T01:30:00Z"));
    cacheUntilMidnight(["UTC"]);

    expect(cacheLife).toHaveBeenCalledWith({
      expire: 22.5 * HOUR + DAY,
      revalidate: HOUR,
      stale: 300,
    });
  });

  // The first visitor after midnight gets the day's copy at once while the next day's is worked
  // out behind it: nobody waits on that work.
  it("works it out again at the next midnight of the earliest time zone, without dropping it", () => {
    // 02:50 UTC is 23:50 in São Paulo: ten minutes to its midnight.
    vi.setSystemTime(new Date("2026-10-14T02:50:00Z"));
    cacheUntilMidnight(["UTC", "America/Sao_Paulo"]);

    expect(cacheLife).toHaveBeenCalledWith({ expire: 600 + DAY, revalidate: 600, stale: 300 });
  });

  it("works it out again on the first request after midnight, a second before it", () => {
    vi.setSystemTime(new Date("2026-10-14T23:59:59.500Z"));
    cacheUntilMidnight(["UTC"]);

    expect(cacheLife).toHaveBeenCalledWith({ expire: 1 + DAY, revalidate: 1, stale: 300 });
  });
});
