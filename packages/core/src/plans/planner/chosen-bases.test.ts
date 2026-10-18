import { describe, expect, it } from "vitest";
import { getKeptBaseChoices } from "./chosen-bases";
import { type ExistingPlanItem } from "./plan-items";
import { type BaseChoice, type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

function skill(skillId: string, lessons: number): PlanGraphSkill {
  return { area: "Biologia", lessons, name: skillId, phase: 0, skillId, weight: null };
}

function lessonsFor(skillId: string, count: number): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterId: skillId,
    lessonId: `${skillId}-${index}`,
    minutes: 4,
    skillIds: [skillId],
    title: `${skillId} ${index + 1}`,
  }));
}

function item(lessonId: string, status: ExistingPlanItem["status"]): ExistingPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    id: lessonId,
    kind: "lesson",
    lessonId,
    phase: 0,
    position: 0,
    scheduledFor: null,
    skillId: lessonId.split("-")[0] ?? null,
    status,
    titleSnapshot: lessonId,
  };
}

/** Prokaryotes' core (its first lesson of three) is done; the membrane's lessons are all to do. */
function keptChoices(choices: Record<string, BaseChoice>) {
  return getKeptBaseChoices({
    graph: { phases: [], skills: [skill("prokaryotes", 3), skill("membrane", 5)] },
    items: [
      item("prokaryotes-0", "done"),
      ...["membrane-0", "membrane-1"].map((lessonId) => item(lessonId, "todo")),
    ],
    lessons: [...lessonsFor("prokaryotes", 3), ...lessonsFor("membrane", 5)],
    settings: parsePlanSettings({
      baseChoices: Object.entries(choices).map(([skillId, choice]) => ({ choice, skillId })),
    }),
  });
}

// Class test seed 1255: the learner chose a quick lesson for prokaryotes, whose core they had
// studied. Kept, the choice planned the plan the way a plan with choices goes: work set aside came
// back, and cell theory left it. A choice of no more than a base's core for a base whose core the
// learner studied changes nothing (R15).
describe(getKeptBaseChoices, () => {
  it("drops a choice of no more than its core for a base whose core the learner studied", () => {
    expect(keptChoices({ membrane: "quick", prokaryotes: "quick" })).toStrictEqual([
      { choice: "quick", skillId: "membrane" },
    ]);

    expect(keptChoices({ prokaryotes: "skip" })).toStrictEqual([]);
  });

  it("keeps deep study of a base whose core the learner studied", () => {
    expect(keptChoices({ prokaryotes: "deep" })).toStrictEqual([
      { choice: "deep", skillId: "prokaryotes" },
    ]);
  });
});
