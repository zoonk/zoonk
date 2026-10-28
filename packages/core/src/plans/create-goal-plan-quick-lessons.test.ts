import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { enemBiologyGoal, setClock } from "./_test-utils/enem-biology";
import * as quickBases from "./_utils/quick-bases";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";

async function setup() {
  const built = await enemBiologyGoal({ days: 30 });
  mockSession(built.user.id);
  return built;
}

function findQuickLessons(skillId: string) {
  return prisma.lesson.findMany({
    select: { id: true },
    where: { identityKey: { endsWith: `quick:${skillId}` } },
  });
}

async function skillLessons({ planId, skillId }: { planId: string; skillId: string }) {
  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId, skillId },
  });

  return items.map((item) => item.lessonId);
}

describe("a new plan's quick lessons, created after it's saved", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("places the quick lesson when a run that stopped after saving the plan runs again", async () => {
    const { goal, graph, living, plan } = await setup();
    const input = { goalId: goal.id, graph, setup: "steps" as const };

    vi.spyOn(quickBases, "ensureQuickBaseLessons").mockRejectedValueOnce(
      new Error("The run stopped"),
    );

    await expect(createGoalPlan(input)).rejects.toThrow("The run stopped");

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(parsePlanSettings(saved.settings).baseChoices).toMatchObject([
      { choice: "quick", skillId: living.id },
    ]);

    await expect(skillLessons({ planId: plan.id, skillId: living.id })).resolves.toStrictEqual([
      null,
    ]);

    await expect(createGoalPlan(input)).resolves.toStrictEqual({
      setupTasks: saved.setupTasks,
      status: "created",
    });

    const [quick] = await findQuickLessons(living.id);
    const placed = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await expect(skillLessons({ planId: plan.id, skillId: living.id })).resolves.toStrictEqual([
      quick?.id,
    ]);

    await expect(createGoalPlan(input)).resolves.toMatchObject({ status: "unchanged" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      version: placed.version,
    });
  });

  it("places one quick lesson when another run creates it at the same moment", async () => {
    const { goal, graph, living, plan } = await setup();
    const ensure = quickBases.ensureQuickBaseLessons;

    vi.spyOn(quickBases, "ensureQuickBaseLessons").mockImplementationOnce(async (settings) => {
      await Promise.all([ensure(settings), ensure(settings)]);
    });

    await expect(createGoalPlan({ goalId: goal.id, graph })).resolves.toMatchObject({
      status: "created",
    });

    const quick = await findQuickLessons(living.id);

    expect(quick).toHaveLength(1);

    await expect(skillLessons({ planId: plan.id, skillId: living.id })).resolves.toStrictEqual([
      quick[0]?.id,
    ]);
  });

  it("keeps a change the learner made while the quick lesson was created", async () => {
    const { goal, graph, living, plan } = await setup();
    const ensure = quickBases.ensureQuickBaseLessons;

    vi.spyOn(quickBases, "ensureQuickBaseLessons").mockImplementationOnce(async (settings) => {
      await ensure(settings);

      await changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 45 }], timeZone: "UTC" },
      });
    });

    await createGoalPlan({ goalId: goal.id, graph });

    const [quick] = await findQuickLessons(living.id);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 45,
    });

    await expect(skillLessons({ planId: plan.id, skillId: living.id })).resolves.toStrictEqual([
      quick?.id,
    ]);

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });
  });
});
