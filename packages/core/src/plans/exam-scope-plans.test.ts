import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENGLISH_JA,
  GERMAN_JA,
  INFORMATICS,
  KOKUGO,
  MATH_I_A,
  commonTestBlueprintFixture,
} from "../exams/choices/_test-utils/choice-blueprint";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanGraph } from "./planner/plan-state";

/** A Monday in 2020, before other tests' learning events, so pace estimates stay out of it. */
const NOW = new Date("2020-09-28T12:00:00Z");

const AREAS = [KOKUGO, MATH_I_A, ENGLISH_JA, GERMAN_JA, INFORMATICS];

async function planAreas(examSubjects: string[]) {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    commonTestBlueprintFixture(),
    planLibraryFixture({ skills: AREAS.map((area) => ({ area, lessons: 1 })) }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 60,
    examBlueprintId: blueprint.id,
    kind: "exam",
    language: "ja",
    settings: { examSubjects, startDate: "2020-09-28" },
    timezone: "Asia/Tokyo",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  return parsePlanGraph(saved.graph).skills.map((skill) => skill.area);
}

describe("a plan for some of an exam's subjects", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("studies only the subjects the learner prepares", async () => {
    await expect(planAreas(["英語"])).resolves.toStrictEqual([ENGLISH_JA]);
    await expect(planAreas(["英語", "数学"])).resolves.toStrictEqual([MATH_I_A, ENGLISH_JA]);
  });

  it("studies every subject but the unpicked options for the whole exam", async () => {
    await expect(planAreas([])).resolves.toStrictEqual([KOKUGO, MATH_I_A, INFORMATICS]);
  });
});
