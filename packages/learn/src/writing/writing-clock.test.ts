import { MAX_WRITING_MS } from "@zoonk/core/exams/essays/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWritingClock } from "./writing-clock";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe(createWritingClock, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "performance"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts from the first keystroke, only while the page is in view", () => {
    const clock = createWritingClock();
    vi.advanceTimersByTime(5 * MINUTE);
    clock.typed({ visible: true });
    vi.advanceTimersByTime(10 * MINUTE);
    clock.hidden();
    vi.advanceTimersByTime(DAY);
    clock.visible();
    vi.advanceTimersByTime(3 * MINUTE);

    expect(clock.durationMs()).toBe(13 * MINUTE);
  });

  it("isn't moved by a change to the device's time", () => {
    const clock = createWritingClock();
    clock.typed({ visible: true });
    vi.advanceTimersByTime(4 * MINUTE);
    vi.setSystemTime(Date.now() - 2 * DAY);
    expect(clock.durationMs()).toBe(4 * MINUTE);

    vi.setSystemTime(Date.now() + 3 * DAY);
    expect(clock.durationMs()).toBe(4 * MINUTE);
  });

  it("never sends more than the server accepts", () => {
    const clock = createWritingClock();
    clock.typed({ visible: true });
    vi.advanceTimersByTime(2 * DAY);

    expect(clock.durationMs()).toBe(MAX_WRITING_MS);
  });

  it("starts again from zero for a rewrite", () => {
    const clock = createWritingClock();
    clock.typed({ visible: true });
    vi.advanceTimersByTime(MINUTE);
    clock.reset();
    clock.visible();

    expect(clock.durationMs()).toBe(0);
  });
});
