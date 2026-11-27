import { beforeEach, vi } from "vitest";

export function installTestClock(): void {
  const value = process.env.ZOONK_TEST_NOW;

  if (!value) {
    return;
  }

  const instant = new Date(value);

  if (Number.isNaN(instant.getTime())) {
    throw new TypeError(`Invalid ZOONK_TEST_NOW: ${value}`);
  }

  function startClock(): void {
    vi.useFakeTimers({
      advanceTimeDelta: 1,
      now: instant,
      shouldAdvanceTime: true,
      toFake: ["Date"],
    });
  }

  startClock();

  beforeEach(() => {
    if (!vi.getMockedSystemTime()) {
      startClock();
    }
  });
}
