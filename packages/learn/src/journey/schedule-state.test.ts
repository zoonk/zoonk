import { describe, expect, it } from "vitest";
import { getPlanDaysLeft, showsPausedSchedule } from "./schedule-state";

describe(showsPausedSchedule, () => {
  it.each([
    { kind: "pastDate", lessons: 4 },
    { kind: "finished" },
    { challenges: 1, kind: "challengesLeft" },
  ] as const)("keeps the $kind schedule state while paused", (status) => {
    expect(showsPausedSchedule({ paused: true, status })).toBe(false);
  });

  it("reads paused for a paused plan with time left", () => {
    expect(showsPausedSchedule({ paused: true, status: { kind: "onTrack" } })).toBe(true);
  });

  it("reads the plan's own state when it isn't paused", () => {
    expect(showsPausedSchedule({ paused: false, status: { kind: "onTrack" } })).toBe(false);
  });
});

describe(getPlanDaysLeft, () => {
  const today = "2026-11-25";

  it("counts the days to the goal's date", () => {
    expect(getPlanDaysLeft({ exam: false, paused: false, targetDate: "2026-12-05", today })).toBe(
      10,
    );
  });

  it("counts nothing for a paused goal with its own end date, which the pause moves", () => {
    expect(
      getPlanDaysLeft({ exam: false, paused: true, targetDate: "2026-12-05", today }),
    ).toBeNull();
  });

  it("keeps counting to a paused exam's date, which doesn't move", () => {
    expect(getPlanDaysLeft({ exam: true, paused: true, targetDate: "2026-12-05", today })).toBe(10);
  });

  it("counts nothing without a date or once it has passed", () => {
    expect(getPlanDaysLeft({ exam: false, paused: false, targetDate: null, today })).toBeNull();

    expect(
      getPlanDaysLeft({ exam: true, paused: false, targetDate: "2026-11-24", today }),
    ).toBeNull();
  });
});
