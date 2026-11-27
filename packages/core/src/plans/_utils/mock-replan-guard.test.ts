import { describe, expect, it } from "vitest";
import { addDays, fromIsoDate } from "../planner/plan-calendar";
import { type PlannedItem } from "../planner/plan-items";
import { parsePlanPhases } from "../planner/plan-state";
import { holdsSchedule } from "./mock-replan-guard";

const today = fromIsoDate("2026-11-01");

function plan({
  coreFits = true,
  coveredRaw = 40,
  coveredShare = 0.9,
  droppedSkillIds = ["statistics"],
  endDate = "2026-12-01",
  lessonId = "algebra",
  reviewDays = ["2027-01-02", "2027-01-03"],
  scheduledFor = addDays(today, 2),
  teachingEnd = "2027-01-01",
}: {
  coreFits?: boolean;
  coveredRaw?: number;
  coveredShare?: number;
  droppedSkillIds?: string[];
  endDate?: string;
  lessonId?: string;
  reviewDays?: string[];
  scheduledFor?: Date;
  teachingEnd?: string;
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

  const reviews = reviewDays.map((day): PlannedItem => ({
    chapterId: null,
    completedAt: null,
    id: null,
    key: `review:${day}`,
    kind: "review",
    lessonId: null,
    minutes: 30,
    phase: 1,
    scheduledFor: fromIsoDate(day),
    skillId: null,
    status: "todo",
    titleSnapshot: "Review",
  }));

  return {
    built: {
      droppedSkillIds,
      items: [lesson, ...reviews],
      phases: parsePlanPhases([
        { endDate, name: "Base" },
        { endDate: "2027-01-15", name: "Review" },
      ]),
      skillMinutes: [],
      waitingSkillIds: [],
    },
    feasibility: { coreFits, coveredShare, fits: false, timeCovers: false },
    selected: {
      coverage: {
        basis: "selected" as const,
        coreFits,
        coveredShare,
        deadline: "2027-01-01",
        fits: false,
        measure: "exam" as const,
        shortLessons: [],
        skills: [
          { coveredRaw, requiredRaw: 120, skillId: "math", state: "measured" as const, worth: 0.5 },
        ],
        targetDate: "2027-01-15",
      },
      endDate: teachingEnd,
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

  it("allows a topic's coverage summed from a different split of the same minutes", () => {
    const computed = plan({ coveredRaw: 40 - 6e-14 });

    expect(holdsSchedule({ baseline: plan(), computed, movableFrom: addDays(today, 1) })).toBe(
      true,
    );
  });

  it.each([
    { coveredShare: 0.85 },
    { coveredShare: 0.95 },
    { coreFits: false },
    { coveredRaw: 36 },
  ])("refuses a change in coverage or whether the core fits (%o)", (change) => {
    expect(
      holdsSchedule({ baseline: plan(), computed: plan(change), movableFrom: addDays(today, 1) }),
    ).toBe(false);
  });

  it("allows teaching to finish a day sooner, with the review day that frees", () => {
    const computed = plan({
      reviewDays: ["2027-01-01", "2027-01-02", "2027-01-03"],
      teachingEnd: "2026-12-31",
    });

    expect(holdsSchedule({ baseline: plan(), computed, movableFrom: addDays(today, 1) })).toBe(
      true,
    );
  });

  it.each([
    { teachingEnd: "2027-01-02" },
    { reviewDays: ["2027-01-03"] },
    { reviewDays: ["2027-01-02", "2027-01-04"] },
  ])("refuses teaching that ends later or a review day it loses (%o)", (change) => {
    expect(
      holdsSchedule({ baseline: plan(), computed: plan(change), movableFrom: addDays(today, 1) }),
    ).toBe(false);
  });

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
