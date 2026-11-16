import { afterEach, describe, expect, it, vi } from "vitest";
import { seedClock } from "./scenarios/seed-clock.mts";

afterEach(() => vi.useRealTimers());

describe("scenario rows on the learner's calendar day", () => {
  it.each([
    ["2026-11-16T00:30:00Z", "2026-11-15T00:00:00.000Z"],
    ["2026-07-16T00:30:00Z", "2026-07-15T00:00:00.000Z"],
    ["2026-11-16T05:30:00Z", "2026-11-16T00:00:00.000Z"],
  ])("dates New York rows at %s as %s", (instant, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    const clock = seedClock("America/New_York");
    expect(clock.localDate.toISOString()).toBe(expected);
    expect(clock.now.toISOString()).toBe(new Date(instant).toISOString());
  });
});
