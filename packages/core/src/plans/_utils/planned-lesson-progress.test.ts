import { describe, expect, it } from "vitest";
import { type ExistingPlanItem } from "../planner/plan-items";
import { countPlannedLessonProgress } from "./planned-lesson-progress";

function item(id: string, attrs: Partial<ExistingPlanItem> = {}): ExistingPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    id,
    kind: "lesson",
    lessonId: null,
    lessons: 1,
    phase: 0,
    position: 0,
    scheduledFor: null,
    skillId: "science",
    status: "todo",
    titleSnapshot: id,
    ...attrs,
  };
}

const skillAreas = new Map([
  ["science", "Science"],
  ["art", "Art"],
]);

describe(countPlannedLessonProgress, () => {
  it("counts studied, known and pending lessons once in kept areas, including chapter work", () => {
    const known = item("known", { lessons: 3, status: "testedOut" });

    const items = [
      item("studied", { status: "done" }),
      known,
      known,
      item("chapter", { kind: "chapter" }),
      item("cut", { skillId: "art", status: "done" }),
      item("unknown", { skillId: "other", status: "done" }),
      item("boss", { kind: "boss" }),
    ];

    expect(
      countPlannedLessonProgress({ deadline: true, items, skillAreas, skippedAreas: ["Art"] }),
    ).toStrictEqual({ lessonsDone: 1, lessonsKnown: 3, lessonsTotal: 5 });
  });

  it("uses the whole plan's chapter mapping when counting one phase", () => {
    const items = [
      item("chapter", {
        chapterId: "chapter",
        kind: "chapter",
        skillId: null,
        status: "testedOut",
      }),
      item("later", { chapterId: "chapter", phase: 1 }),
    ];

    const whole = countPlannedLessonProgress({ deadline: true, items, skillAreas });

    const phases = [0, 1].map((phase) =>
      countPlannedLessonProgress({ deadline: true, items, phase, skillAreas }),
    );

    expect(whole).toStrictEqual({ lessonsDone: 0, lessonsKnown: 1, lessonsTotal: 2 });
    expect(phases.map((phase) => phase.lessonsTotal)).toStrictEqual([1, 1]);
    expect(phases.reduce((sum, phase) => sum + phase.lessonsKnown, 0)).toBe(whole.lessonsKnown);
  });

  it.each([true, false])(
    "keeps set-aside lessons in scope only with a deadline (%s)",
    (deadline) => {
      const items = [
        item("studied", { status: "done" }),
        item("cut", { lessons: 4, status: "skipped" }),
      ];

      expect(countPlannedLessonProgress({ deadline, items, skillAreas })).toStrictEqual({
        lessonsDone: 1,
        lessonsKnown: 0,
        lessonsTotal: deadline ? 5 : 1,
      });
    },
  );
});
