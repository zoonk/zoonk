import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import {
  WAITING_START,
  outlineSkill,
  waitingGoal,
} from "../library/curriculum/_test-utils/waiting-goals";
import {
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "../library/identity/_test-utils/identity-mocks";
import * as planContext from "./_utils/plan-context";
import { createGoalPlan } from "./create-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A learner's calendar write: their daily time changes, and their plans' inputs with it. */
async function setDailyMinutes({
  goalId,
  minutes,
  userId,
}: {
  goalId: string;
  minutes: number;
  userId: string;
}) {
  await prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { planInputs: true, userId });
    await tx.goal.update({ data: { dailyMinutes: minutes }, where: { id: goalId } });
  });
}

/**
 * The learner's write lands once, while a run works its plan out: after it read the goal, before
 * it read the plan. Only the order is the test's; the write and the run are real.
 */
function landAfterGoalRead(write: () => Promise<void>) {
  const load = planContext.loadPlanContext;

  return vi.spyOn(planContext, "loadPlanContext").mockImplementationOnce(async (input) => {
    await write();
    return load(input);
  });
}

describe("a plan worked out while the learner changes what it's planned from", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WAITING_START);
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Saved from the goal as it was read, the first plan would keep the old daily time while
  // saying it planned the new one: it's planned again from the goal as the learner left it.
  it("plans a new goal again when the learner's daily time changes while it's worked out", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const goal = await goalFixture({ dailyMinutes: 10, userId: user.id });

    await prisma.plan.create({
      data: { goalId: goal.id, settings: { startDate: WAITING_START.toISOString().slice(0, 10) } },
    });

    landAfterGoalRead(() => setDailyMinutes({ goalId: goal.id, minutes: 60, userId: user.id }));

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Phase" }],
        skills: [
          {
            area: "Physics",
            lessons: 8,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
    });

    // Planned from the daily time the learner saved: planning again finds nothing to change.
    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });
  });

  // A band's lessons land and a refresh plans them; meanwhile the learner changes their daily
  // time: the refresh saves a plan from the new time, not the one it first read.
  it("refreshes a plan again when the learner's daily time changes while it's worked out", async () => {
    const skill = await skillFixture();
    const { goal } = await waitingGoal(skill, { dailyMinutes: 5 });
    await outlineSkill(skill);

    landAfterGoalRead(() => setDailyMinutes({ goalId: goal.id, minutes: 60, userId: goal.userId }));

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "refreshed",
    });

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });
  });
});
