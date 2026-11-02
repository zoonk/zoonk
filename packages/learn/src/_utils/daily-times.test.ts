import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { describe, expect, it } from "vitest";
import { getDailyTimes } from "./daily-times";

describe(getDailyTimes, () => {
  it("offers every daily time a plan accepts, from its shortest to a whole day", () => {
    const times = getDailyTimes();

    expect(times[0]).toBe(MIN_DAILY_MINUTES);
    expect(times.at(-1)).toBe(MAX_DAILY_MINUTES);
  });

  it("keeps a time shown off the steps in order", () => {
    expect(getDailyTimes(35, null).slice(0, 6)).toStrictEqual([5, 10, 15, 30, 35, 45]);
  });
});
