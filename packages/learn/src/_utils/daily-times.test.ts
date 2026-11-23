import { MAX_PICKABLE_DAILY_MINUTES, MIN_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { describe, expect, it } from "vitest";
import { getDailyTimes } from "./daily-times";

describe(getDailyTimes, () => {
  it("offers every daily time a learner can pick, from the shortest to 8 hours", () => {
    const times = getDailyTimes();

    expect(times[0]).toBe(MIN_DAILY_MINUTES);
    expect(times.at(-1)).toBe(MAX_PICKABLE_DAILY_MINUTES);
  });

  it("keeps a time shown off the steps in order", () => {
    expect(getDailyTimes(35, null).slice(0, 6)).toStrictEqual([5, 10, 15, 30, 35, 45]);
  });

  it("still shows a goal's own time saved above 8 hours, and nothing else above it", () => {
    expect(getDailyTimes(600, 240).filter((minutes) => minutes > 480)).toStrictEqual([600]);
  });
});
