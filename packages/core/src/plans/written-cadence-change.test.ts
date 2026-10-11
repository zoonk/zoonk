import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { getGoalPlan } from "./get-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A Monday in 2020, before the learning events other tests write (see `plan-changes.test.ts`). */
const NOW = new Date("2020-09-28T12:00:00Z");
const TARGET = "2020-11-08";

/**
 * An exam six weeks away with two subjects and an essay of three written-test skills, an hour a
 * day: time for everything, so the final weeks hold the essay at under half of each day.
 */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Preparação"],
    skills: [
      { area: "Matemática", lessons: 12 },
      { area: "Biologia", lessons: 12 },
      { area: "Redação", lessons: 6 },
      { area: "Redação", lessons: 6 },
      { area: "Redação", lessons: 6 },
    ],
  });

  // The skill graph gives an exam outcome skills only for the parts answered in writing.
  const graph = {
    ...library.graph,
    skills: library.graph.skills.map((skill) =>
      skill.area === "Redação" ? { ...skill, outcome: true } : skill,
    ),
  };

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 60,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date(`${TARGET}T00:00:00Z`),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph });
  mockSession(user.id);

  const essaySkillIds = new Set(
    graph.skills.filter((skill) => skill.outcome).map((skill) => skill.skillId),
  );

  return { essaySkillIds, goal, plan };
}

/** The days the plan's essay lessons are due, in order. */
async function writtenDays({
  planId,
  essaySkillIds,
}: {
  planId: string;
  essaySkillIds: Set<string>;
}) {
  const items = await prisma.planItem.findMany({
    orderBy: { scheduledFor: "asc" },
    where: { kind: "lesson", planId, skillId: { in: [...essaySkillIds] } },
  });

  return items.map((item) => item.scheduledFor?.toISOString().slice(0, 10) ?? "");
}

describe("the written tests' cadence", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves the essay's lessons to the final weeks, keeps them all, and undoes", async () => {
    const { goal, plan, essaySkillIds } = await setup();
    const weekly = await writtenDays({ essaySkillIds, planId: plan.id });

    // Every week by default: the essay starts in the plan's first week.
    expect(weekly[0] && weekly[0] < "2020-10-05").toBe(true);

    const result = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ cadence: "finalWeeks", kind: "setWrittenCadence" }] },
    });

    expect(result).toMatchObject({ status: "applied" });

    const final = await writtenDays({ essaySkillIds, planId: plan.id });

    // The final weeks of a six-week plan: its last three, from 18 Oct.
    expect(final).toHaveLength(weekly.length);
    expect(final.every((day) => day >= "2020-10-18" && day < TARGET)).toBe(true);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      settings: { writtenCadence: "finalWeeks" },
    });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: {
        writtenPractice: {
          cadence: "finalWeeks",
          finalWeeksFrom: "2020-10-18",
          parts: ["Redação"],
        },
      },
    });

    const change = result.status === "applied" ? result.change : null;

    await decidePlanChange({
      changeId: change?.id ?? "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    await expect(writtenDays({ essaySkillIds, planId: plan.id })).resolves.toStrictEqual(weekly);
  });
});
