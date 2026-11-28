import { describe, expect, it } from "vitest";
import { fromIsoDate } from "../planner/plan-calendar";
import { parsePlanSettings } from "../planner/plan-state";
import { type PlanReadItem } from "./plan-read-projection";
import { type PlanSummary } from "./plan-summary";
import { readSavedCourseForecast } from "./saved-course-forecast";

function item(kind: "lesson" | "boss", phase = 0): PlanReadItem {
  return {
    chapterId: null,
    completedAt: null,
    id: kind,
    kind,
    lessonId: kind === "lesson" ? "lesson" : null,
    minutes: 15,
    phase,
    position: 0,
    scheduledFor: fromIsoDate("2026-11-30"),
    skillId: "skill",
    status: "todo",
    titleSnapshot: kind,
  };
}

const summary = {
  basis: { layoutStudyDay: "2026-11-27" },
  selected: { forecast: { finish: { date: "2026-11-30", precision: "month" } } },
} as PlanSummary;

function forecast(items: PlanReadItem[], later = false) {
  return readSavedCourseForecast({
    context: {
      goal: { dailyMinutes: 45, kind: "learn", targetDate: null },
      items,
      phases: [0, 1].map((index) => ({
        endDate: later && index === 1 ? null : "2026-11-30",
        kind: "learn" as const,
        ...(later && index === 1 && { later: true as const }),
        milestone: null,
        minutes: 15,
        name: `${index}`,
        startDate: later && index === 1 ? null : "2026-11-27",
      })),
      state: {
        settings: parsePlanSettings({
          startDate: "2026-11-27",
          weekdayMinutes: [0, 45, 45, 45, 45, 45, 0],
        }),
      },
      today: fromIsoDate("2027-01-06"),
    },
    summary,
  });
}

describe(readSavedCourseForecast, () => {
  it("keeps a saved finish date when an unwritten phase stays later", () => {
    const saved = forecast([], true);

    expect(saved.finish).toStrictEqual({ date: "2026-11-30", precision: "month" });
    expect(saved.phases[1]).toMatchObject({ endDate: null, later: true, startDate: null });
  });

  it("moves the finish when only an overdue challenge remains", () => {
    expect(forecast([item("boss")]).finish?.date).toBe("2027-01-06");
  });

  it("moves a following phase's overdue start with the work before it", () => {
    expect(forecast([item("lesson"), item("boss", 1)]).phases[1]?.startDate).toBe("2027-01-06");
  });

  it("keeps the dates of completed work", () => {
    expect(forecast([{ ...item("boss"), status: "done" }]).finish?.date).toBe("2026-11-30");
  });
});
