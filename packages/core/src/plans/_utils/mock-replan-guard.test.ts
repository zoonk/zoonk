import { describe, expect, it } from "vitest";
import { addDays, fromIsoDate } from "../planner/plan-calendar";
import { type PlannedItem } from "../planner/plan-items";
import { parsePlanPhases } from "../planner/plan-state";
import { holdsSchedule } from "./mock-replan-guard";

const today = fromIsoDate("2026-11-01");

function plan({
  coreFits = true,
  coveredShare = 0.9,
  droppedSkillIds = ["statistics"],
  endDate = "2026-12-01",
  lessonId = "algebra",
  scheduledFor = addDays(today, 2),
}: {
  coreFits?: boolean;
  coveredShare?: number;
  droppedSkillIds?: string[];
  endDate?: string;
  lessonId?: string;
  scheduledFor?: Date;
} = {}) {
  const lesson: PlannedItem = {
    chapterId: null,
    completedAt: null,
    id: lessonId,
    key: `lesson:${lessonId}`,
    kind: "lesson",
    lessonId,
    minutes: 10,
    phase: 0,
    scheduledFor,
    skillId: "math",
    status: "todo",
    titleSnapshot: "Algebra",
  };

  return {
    built: {
      droppedSkillIds,
      items: [lesson],
      phases: parsePlanPhases([
        { endDate, name: "Base" },
        { endDate: "2027-01-15", name: "Review" },
      ]),
      skillMinutes: [],
      waitingSkillIds: [],
    },
    feasibility: { coreFits, coveredShare, fits: false, timeCovers: false },
    selected: {
      coverage: null,
      endDate,
      forecast: {
        basis: "estimated" as const,
        dailyNeed: { basis: "estimated" as const, minutes: 20 },
        finish: { date: endDate },
      },
    },
  };
}

describe(holdsSchedule, () => {
  it("allows a future lesson to move", () => {
    const computed = plan({ scheduledFor: addDays(today, 3) });

    expect(holdsSchedule({ baseline: plan(), computed, movableFrom: addDays(today, 1) })).toBe(
      true,
    );
  });

  it.each([{ coveredShare: 0.85 }, { coveredShare: 0.95 }, { coreFits: false }])(
    "refuses a change in coverage or whether the core fits (%o)",
    (change) => {
      expect(
        holdsSchedule({ baseline: plan(), computed: plan(change), movableFrom: addDays(today, 1) }),
      ).toBe(false);
    },
  );

  it("refuses to substitute a different lesson on the same topic", () => {
    const computed = plan({ lessonId: "geometry" });

    expect(holdsSchedule({ baseline: plan(), computed, movableFrom: addDays(today, 1) })).toBe(
      false,
    );
  });

  it("refuses to move today's lessons", () => {
    const baseline = plan({ scheduledFor: today });

    expect(holdsSchedule({ baseline, computed: plan(), movableFrom: addDays(today, 1) })).toBe(
      false,
    );
  });

  it("refuses one that leaves out a topic the plan keeps without it", () => {
    const computed = plan({ droppedSkillIds: ["statistics", "geometry"] });

    expect(holdsSchedule({ baseline: plan(), computed, movableFrom: addDays(today, 1) })).toBe(
      false,
    );
  });

  it("refuses one that moves a phase's end", () => {
    const computed = plan({ endDate: "2026-12-08" });

    expect(holdsSchedule({ baseline: plan(), computed, movableFrom: addDays(today, 1) })).toBe(
      false,
    );
  });
});
