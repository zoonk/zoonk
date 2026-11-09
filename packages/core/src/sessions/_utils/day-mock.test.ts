import { describe, expect, it } from "vitest";
import { isMockOnlyDay } from "./day-mock";

const today = new Date("2026-10-06T00:00:00Z");

const goal = {
  dailyMinutes: 30,
  kind: "exam" as const,
  targetDate: new Date("2026-10-07T00:00:00Z"),
};

describe(isMockOnlyDay, () => {
  it.each([
    { hasMock: true, onlyMock: true, settings: {} },
    { hasMock: false, onlyMock: false, settings: {} },
    { hasMock: true, onlyMock: false, settings: { shortMockMinutes: 10, startDate: "2026-10-06" } },
    { hasMock: true, onlyMock: true, settings: { shortMockMinutes: 10, startDate: "2026-10-05" } },
    { hasMock: true, onlyMock: true, settings: { shortMockMinutes: 20, startDate: "2026-10-06" } },
  ])(
    "respects the planner's mock event: $settings, mock $hasMock",
    ({ hasMock, onlyMock, settings }) => {
      expect(isMockOnlyDay({ goal, hasMock, planSettings: settings, today })).toBe(onlyMock);
    },
  );

  it("keeps a moved mock's original day rule", () => {
    expect(
      isMockOnlyDay({
        goal,
        hasMock: true,
        planSettings: {
          movedEvents: [{ from: "2026-10-06", to: "2026-10-08" }],
          shortMockMinutes: 10,
          startDate: "2026-10-06",
        },
        today: new Date("2026-10-08T00:00:00Z"),
      }),
    ).toBe(false);
  });
});
