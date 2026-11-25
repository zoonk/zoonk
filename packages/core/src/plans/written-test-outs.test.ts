import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { type PlanGraph } from "./planner/plan-state";

const PLACED_AT = new Date("2020-09-28T12:05:00Z");

async function setup() {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    structure: {
      formats: [
        {
          citation: { passage: "", sourceId: "notice" },
          description: "Discursive answer",
          kind: "essay",
          options: null,
          sections: ["Discursiva"],
        },
      ],
      mock: null,
      rules: [],
      subjects: [],
    },
  });

  const library = await planLibraryFixture({
    phases: ["Preparação"],
    skills: [
      { area: "Português", lessons: 6 },
      { area: "Discursiva", lessons: 6 },
      { area: "Direito", lessons: 12 },
    ],
  });

  const [language, essay] = library.graph.skills;
  const languageId = language?.skillId ?? "";

  const toGraph = (writtenAreaIds: Set<string>): PlanGraph => ({
    ...library.graph,
    skills: library.graph.skills.map((skill) =>
      writtenAreaIds.has(skill.skillId) ? { ...skill, area: "Discursiva", outcome: true } : skill,
    ),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 60,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-11-08T00:00:00Z"),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: toGraph(new Set([essay?.skillId ?? ""])) });
  mockSession(user.id);

  const { items, skills } = await loadGoalPlan(goal.id);

  // Practiced with objective answers while the skill counted for the objective test.
  await learnerSkillFixture({ reps: 7, skillId: languageId, state: "solid", userId: user.id });

  await markPlanItemsTestedOut({
    goalId: goal.id,
    items,
    knownSkillIds: new Set([languageId]),
    placedSkills: skills,
    testedOutAt: PLACED_AT,
    timeZone: "UTC",
  });

  return {
    goal,
    languageId,
    moved: toGraph(new Set([essay?.skillId ?? "", languageId])),
    plan,
    user,
  };
}

function lessonsOf({ planId, skillId }: { planId: string; skillId: string }) {
  return prisma.planItem.findMany({
    select: { completedAt: true, scheduledFor: true, status: true },
    where: { kind: "lesson", planId, skillId },
  });
}

describe("a skill that joins an exam's written part", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("brings back the lessons it was tested out of and forgets what objective answers claimed", async () => {
    const { goal, languageId, moved, plan, user } = await setup();

    const before = await lessonsOf({ planId: plan.id, skillId: languageId });
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((item) => item.status === "testedOut")).toBe(true);

    vi.setSystemTime(new Date("2020-09-30T12:00:00Z"));
    await createGoalPlan({ goalId: goal.id, graph: moved });

    const after = await lessonsOf({ planId: plan.id, skillId: languageId });

    expect(after.length).toBeGreaterThan(0);

    expect(after).toStrictEqual(
      after.map(() => ({
        completedAt: null,
        scheduledFor: expect.toSatisfy(
          (day: Date | null) => day !== null && day >= new Date("2020-09-30T00:00:00Z"),
        ),
        status: "todo",
      })),
    );

    await expect(
      prisma.learnerSkill.findUniqueOrThrow({
        where: { userSkill: { skillId: languageId, userId: user.id } },
      }),
    ).resolves.toMatchObject({ reps: 0, state: "new" });
  });
});
