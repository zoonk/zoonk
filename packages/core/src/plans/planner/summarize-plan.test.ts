import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { parsePlanGraph } from "./plan-state";
import { summarizePlan } from "./summarize-plan";

function lesson({
  day,
  phase,
  status = "todo",
}: {
  day: string;
  phase: number;
  status?: PlannedItem["status"];
}): PlannedItem {
  return {
    chapterId: null,
    completedAt: status === "todo" ? null : fromIsoDate(day),
    id: null,
    key: `lesson:${phase}:${day}`,
    kind: "lesson",
    lessonId: `${phase}-${day}`,
    minutes: 10,
    phase,
    scheduledFor: fromIsoDate(day),
    skillId: null,
    status,
    titleSnapshot: `Lesson ${phase} ${day}`,
  };
}

describe(summarizePlan, () => {
  // Career seed 1013: in-session questions tested out the portfolio phase on 10-14, and the job
  // search phase after it started 10-15, before the UX process phase that runs to 10-31.
  it("starts a phase after the ones before it, not after one a test-out finished early", () => {
    const graph = parsePlanGraph({
      phases: [
        { milestone: null, name: "UX process" },
        { milestone: null, name: "Portfolio" },
        { milestone: null, name: "Job search" },
      ],
    });

    const { phases } = summarizePlan({
      graph,
      items: [
        lesson({ day: "2026-10-14", phase: 0 }),
        lesson({ day: "2026-10-31", phase: 0 }),
        lesson({ day: "2026-10-14", phase: 1, status: "testedOut" }),
        lesson({ day: "2026-11-01", phase: 2 }),
        lesson({ day: "2026-11-20", phase: 2 }),
      ],
      scheduleStart: fromIsoDate("2026-10-14"),
      windows: [],
    });

    expect(
      phases.map(({ endDate, name, startDate }) => ({ endDate, name, startDate })),
    ).toStrictEqual([
      { endDate: "2026-10-31", name: "UX process", startDate: "2026-10-14" },
      { endDate: "2026-10-14", name: "Portfolio", startDate: "2026-10-14" },
      { endDate: "2026-11-20", name: "Job search", startDate: "2026-11-01" },
    ]);
  });
});
