import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type z } from "zod";
import { mockSession } from "../_test-utils/mock-session";
import { createGoals } from "../goals/create-goals";
import { updateGoal } from "../goals/update-goal";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { previewPlanChange } from "./preview-plan-change";
import { isInputRangeError } from "./target-date-range";

/** A Monday in 2020, before the learning events other tests write. */
const MONDAY = new Date("2020-09-28T12:00:00Z");
const LAST_DAY = "2030-09-26";
const TOO_FAR = "2030-09-27";

async function plannedGoal({ targetDate }: { targetDate?: string } = {}) {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] }),
  ]);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    targetDate: targetDate ? new Date(`${targetDate}T00:00:00Z`) : null,
    title: "Algebra",
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return { goal, user };
}

async function readGoal(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  const changes = await prisma.planChange.count({ where: { plan: { goalId } } });

  return {
    changes,
    targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
    title: goal.title,
  };
}

async function refusal(run: () => Promise<unknown>): Promise<z.ZodError | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (isInputRangeError(error)) {
      return error;
    }

    throw error;
  }
}

describe("a target date past what a plan reaches", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["2020-09-27", "2020-09-28"])(
    "refuses a new goal's explicit date %s before any goal or plan is written",
    async (targetDate) => {
      const user = await userFixture();
      mockSession(user.id);

      const error = await refusal(() =>
        createGoals({
          dailyMinutes: 15,
          goals: [
            { kind: "learn", language: "en", prompt: "Algebra", targetDate, title: "Algebra" },
          ],
          timeZone: "UTC",
        }),
      );

      expect(error?.issues).toMatchObject([
        { params: { bound: "earliest", limit: "2020-09-29" }, path: ["goals", 0, "targetDate"] },
      ]);

      await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(0);
      await expect(prisma.plan.count({ where: { goal: { userId: user.id } } })).resolves.toBe(0);
    },
  );

  it("is refused by a plan change and its preview before anything is saved; the last day is taken", async () => {
    const { goal } = await plannedGoal();
    const before = await readGoal(goal.id);
    const operations = [{ kind: "setTargetDate" as const, targetDate: TOO_FAR }];

    const [changed, previewed] = await Promise.all([
      refusal(() => changeGoalPlan({ goalId: goal.id, input: { operations } })),
      refusal(() => previewPlanChange({ goalId: goal.id, input: { operations } })),
    ]);

    for (const error of [changed, previewed]) {
      expect(error?.issues).toMatchObject([
        { params: { bound: "latest", limit: LAST_DAY }, path: ["operations", 0, "targetDate"] },
      ]);
    }

    await expect(readGoal(goal.id)).resolves.toStrictEqual(before);

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setTargetDate", targetDate: LAST_DAY }] },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    await expect(readGoal(goal.id)).resolves.toMatchObject({ targetDate: LAST_DAY });
  });

  it("is refused by the goal's settings with nothing saved, while a passed date the goal keeps stays", async () => {
    const { goal } = await plannedGoal({ targetDate: "2020-09-01" });

    const error = await refusal(() =>
      updateGoal({ goalId: goal.id, input: { targetDate: TOO_FAR, title: "Physics" } }),
    );

    expect(error?.issues).toMatchObject([{ path: ["targetDate"] }]);
    await expect(readGoal(goal.id)).resolves.toMatchObject({ title: "Algebra" });

    await expect(
      updateGoal({ goalId: goal.id, input: { targetDate: "2020-09-01", title: "Physics" } }),
    ).resolves.toMatchObject({ goal: { targetDate: "2020-09-01", title: "Physics" } });
  });

  it("is refused for a new goal before it's created", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const goal = { kind: "learn" as const, language: "en", prompt: "Algebra", title: "Algebra" };

    const error = await refusal(() =>
      createGoals({
        dailyMinutes: 15,
        goals: [goal, { ...goal, targetDate: TOO_FAR }],
        timeZone: "UTC",
      }),
    );

    expect(error?.issues).toMatchObject([{ path: ["goals", 1, "targetDate"] }]);
    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      createGoals({
        dailyMinutes: 15,
        goals: [{ ...goal, targetDate: LAST_DAY }],
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({ goals: [{ targetDate: LAST_DAY }], status: "created" });
  });
});
