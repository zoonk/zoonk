import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { enemBiologyGoal, setClock } from "./_test-utils/enem-biology";
import * as quickBases from "./_utils/quick-bases";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** Lucas's ENEM goal 30 days out, which starts its bases on a quick lesson each. */
async function setup() {
  const built = await enemBiologyGoal({ days: 30 });
  mockSession(built.user.id);
  return built;
}

/** The base's quick lessons ("Quick lesson") in the Library. */
function findQuickLessons(skillId: string) {
  return prisma.lesson.findMany({
    select: { id: true },
    where: { identityKey: { endsWith: `quick:${skillId}` } },
  });
}

/** The lessons the plan has for the skill: a lesson's id, or `null` for its stand-in. */
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

  // The run saved the plan on the recommendation (a quick lesson for the base, a stand-in until it
  // exists), then stopped before creating it: running again creates and places it, still sets the
  // plan up, and a last run changes nothing.
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

  // Another learner's run creates the same base's quick lesson at the same moment: one lesson is
  // created, and the plan places it.
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

  // The learner changes their daily time while the quick lesson is created: the plan places it from
  // the plan as they left it, keeping their change.
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
