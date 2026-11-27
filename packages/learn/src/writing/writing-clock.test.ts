import { MAX_WRITING_MS } from "@zoonk/core/exams/essays/contract";
import { MS_PER_DAY, MS_PER_MINUTE } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWritingClock } from "./writing-clock";

describe(createWritingClock, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "performance"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts from the first keystroke, only while the page is in view", () => {
    const clock = createWritingClock();
    vi.advanceTimersByTime(5 * MS_PER_MINUTE);
    clock.typed({ visible: true });
    vi.advanceTimersByTime(10 * MS_PER_MINUTE);
    clock.hidden();
    vi.advanceTimersByTime(MS_PER_DAY);
    clock.visible();
    vi.advanceTimersByTime(3 * MS_PER_MINUTE);

    expect(clock.durationMs()).toBe(13 * MS_PER_MINUTE);
  });

  it("isn't moved by a change to the device's time", () => {
    const clock = createWritingClock();
    clock.typed({ visible: true });
    vi.advanceTimersByTime(4 * MS_PER_MINUTE);
    vi.setSystemTime(Date.now() - 2 * MS_PER_DAY);
    expect(clock.durationMs()).toBe(4 * MS_PER_MINUTE);

    vi.setSystemTime(Date.now() + 3 * MS_PER_DAY);
    expect(clock.durationMs()).toBe(4 * MS_PER_MINUTE);
  });

  it("never sends more than the server accepts", () => {
    const clock = createWritingClock();
    clock.typed({ visible: true });
    vi.advanceTimersByTime(2 * MS_PER_DAY);

    expect(clock.durationMs()).toBe(MAX_WRITING_MS);
  });

  it("starts again from zero for a rewrite", () => {
    const clock = createWritingClock();
    clock.typed({ visible: true });
    vi.advanceTimersByTime(MS_PER_MINUTE);
    clock.reset();
    clock.visible();

    expect(clock.durationMs()).toBe(0);
  });
});
