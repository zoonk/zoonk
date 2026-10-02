import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getRecentRebalance } from "../plans/get-recent-rebalance";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { rebalancePlanAfterSession } from "./rebalance-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** A Wednesday in 2020, before other tests' learning events, so the planner's pace is its own. */
const NOW = new Date("2020-09-30T12:00:00Z");
const DAY_MS = 86_400_000;

/** Well remembered: reviewed yesterday with a month of stability. */
const REMEMBERED = {
  difficulty: 5,
  lastReviewedAt: new Date(NOW.getTime() - DAY_MS),
  stability: 30,
};

/** Fading: last seen ten days ago with a day of stability. */
const FADING = {
  difficulty: 5,
  lastReviewedAt: new Date(NOW.getTime() - 10 * DAY_MS),
  stability: 1,
};

/**
 * A planned goal with two areas studied this week: Humanities is going well (Solid and
 * remembered), Science is fading. Each area is a chapter of the plan and an area of its graph.
 */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Humanities", "Science"],
    skills: [
      { area: "Humanities", lessons: 2, phase: 0 },
      { area: "Humanities", lessons: 2, phase: 0 },
      { area: "Science", lessons: 2, phase: 1 },
      { area: "Science", lessons: 2, phase: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const studiedAt = new Date(NOW.getTime() - 2 * DAY_MS);
  const [humanities, science] = [library.skills.slice(0, 2), library.skills.slice(2)];

  await Promise.all([
    ...humanities.map((skill) =>
      learnerSkillFixture({
        ...REMEMBERED,
        createdAt: studiedAt,
        reps: 3,
        skillId: skill.id,
        state: "solid",
        userId: user.id,
      }),
    ),
    ...science.map((skill) =>
      learnerSkillFixture({
        ...FADING,
        createdAt: studiedAt,
        reps: 1,
        skillId: skill.id,
        state: "learning",
        userId: user.id,
      }),
    ),
  ]);

  return { goal, plan, user };
}

function rebalances(planId: string) {
  return prisma.planChange.findMany({
    where: { payload: { equals: "preparation", path: ["source"] }, planId },
  });
}

describe(rebalancePlanAfterSession, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves time to the fading area while another goes well, once a week", async () => {
    const { goal, plan, user } = await setup();

    await rebalancePlanAfterSession({ goalId: goal.id, now: NOW, userId: user.id });

    const [change] = await rebalances(plan.id);

    expect(change).toMatchObject({
      payload: { operations: [{ areas: ["Science"], kind: "focusAreas" }] },
      status: "applied",
    });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(saved.settings).focusAreas).toStrictEqual(["Science"]);

    await rebalancePlanAfterSession({ goalId: goal.id, now: NOW, userId: user.id });
    await expect(rebalances(plan.id)).resolves.toHaveLength(1);

    mockSession(user.id);

    await expect(getRecentRebalance(goal.id)).resolves.toMatchObject({
      change: {
        canUndo: true,
        operations: [{ areas: ["Science"], kind: "focusAreas" }],
        reason: null,
        source: "preparation",
      },
      status: "ready",
    });
  });

  it("leaves a plan without a graph alone", async () => {
    const user = await userFixture();
    const { goal, plan } = await unplannedGoalFixture({ userId: user.id });

    await rebalancePlanAfterSession({ goalId: goal.id, now: NOW, userId: user.id });
    await expect(rebalances(plan.id)).resolves.toHaveLength(0);
  });
});
