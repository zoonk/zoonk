import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toOpeningDay, watchOpeningClock } from "./opening-day";

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

  it("reads an instant already past as open, and one it can't read as nothing", () => {
    expect(toOpeningDay({ availableAt: "2026-11-13T23:00:00.000Z", now, timeZone: "UTC" })).toBe(
      "open",
    );

    expect(toOpeningDay({ availableAt: now.toISOString(), now, timeZone: "UTC" })).toBe("open");

    expect(toOpeningDay({ availableAt: "soon", now, timeZone: "UTC" })).toBeNull();
    expect(toOpeningDay({ availableAt: null, now, timeZone: "UTC" })).toBeNull();
  });
});

describe(watchOpeningClock, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("wakes at local midnight before the opening, when tomorrow becomes today", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 13, 23, 59) });

    const availableAt = new Date(2026, 10, 14, 12, 0).toISOString();
    const timeZone = getLocalTimeZone();
    const day = () => toOpeningDay({ availableAt, now: new Date(), timeZone });
    const notify = vi.fn<() => void>();
    const stop = watchOpeningClock(availableAt, notify);

    expect(day()).toBe("tomorrow");

    vi.advanceTimersByTime(2 * 60 * 1000);

    expect(notify).toHaveBeenCalledOnce();
    expect(day()).toBe("today");

    vi.advanceTimersByTime(12 * 60 * 60 * 1000);

    expect(notify).toHaveBeenCalledTimes(2);
    expect(day()).toBe("open");

    stop();
  });
});
