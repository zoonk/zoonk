import { describe, expect, it } from "vitest";
import { showsResumeSchedule } from "./schedule-state";

describe(showsResumeSchedule, () => {
  it.each([
    { kind: "pastDate", lessons: 4 },
    { kind: "finished" },
    { challenges: 1, kind: "challengesLeft" },
  ] as const)("keeps the $kind schedule state while paused", (status) => {
    expect(showsResumeSchedule({ paused: true, status })).toBe(false);
  });

  it("shows the schedule to resume for a paused plan with time left", () => {
    expect(showsResumeSchedule({ paused: true, status: { kind: "onTrack" } })).toBe(true);
  });
});
