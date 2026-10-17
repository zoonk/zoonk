import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AHEAD_START } from "./_test-utils/ahead-plan";
import {
  declineProposals,
  pacedPlanFixture,
  readTodayChange,
  studyEveryLesson,
} from "./_test-utils/estimate-plan";
import { type PlanEffect } from "./planner/plan-effect";
import { refreshGoalPlan } from "./refresh-goal-plan";

const FASTER_SECONDS = 60;
const SLOWER_SECONDS = 600;

async function findChange({ kind, planId }: { kind: string | string[]; planId: string }) {
  const change = await prisma.planChange.findFirstOrThrow({
    where: { kind: { in: [kind].flat() }, planId },
  });

  return { ...change, effect: (change.payload as { effect: PlanEffect }).effect };
}

/** A closer source is news only when more than one seen lesson moves. */
describe("a closer estimate of how long lessons take", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHEAD_START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says on Today how many more lessons fit by the date", async () => {
    // Two weeks: a run after a session keeps this week as the learner saw it, and on a 7-day plan
    // the final challenge (C2) took the one day left after it, so a faster pace fit one lesson more.
    const { goal, plan, user } = await pacedPlanFixture({
      dailyMinutes: 15,
      days: 14,
      lessons: 4,
      skills: 12,
    });

    // Short on time: the plan leaves lessons out that a faster pace can bring in.
    await expect(
      prisma.planItem.count({ where: { kind: "lesson", planId: plan.id } }),
    ).resolves.toBeLessThan(12 * 4);

    await studyEveryLesson({ planId: plan.id, seconds: FASTER_SECONDS, userId: user.id });
    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
    await declineProposals({ goalId: goal.id, planId: plan.id });

    const change = await findChange({ kind: "estimateUpdated", planId: plan.id });

    expect(change.effect.lessonsAdded).toBeGreaterThan(change.effect.lessonsRemoved);

    await expect(readTodayChange(goal.id)).resolves.toMatchObject({
      canUndo: false,
      effect: { lessonsAdded: change.effect.lessonsAdded },
      id: change.id,
      kind: "estimateUpdated",
    });
  });

  it("says on Today how many fewer lessons fit by the date, and which", async () => {
    const { goal, plan, user } = await pacedPlanFixture({
      dailyMinutes: 30,
      days: 14,
      lessons: 6,
      skills: 8,
    });

    await studyEveryLesson({ planId: plan.id, seconds: SLOWER_SECONDS, userId: user.id });
    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
    await declineProposals({ goalId: goal.id, planId: plan.id });

    const change = await findChange({ kind: "estimateUpdated", planId: plan.id });

    expect(change.effect).toMatchObject({ lessonsAdded: 0 });

    expect(change.effect.lessonsRemoved).toBeGreaterThan(0);
    expect(change.effect.lessonsLeftOut).toHaveLength(change.effect.lessonsRemoved);

    await expect(readTodayChange(goal.id)).resolves.toMatchObject({ id: change.id });
  });

  it("keeps topic names with a significant lesson-count change", async () => {
    const { goal, plan, user } = await pacedPlanFixture({
      dailyMinutes: 15,
      days: 7,
      lessons: 4,
      skills: 12,
    });

    await studyEveryLesson({ planId: plan.id, seconds: SLOWER_SECONDS, userId: user.id });
    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
    await declineProposals({ goalId: goal.id, planId: plan.id });

    const change = await findChange({ kind: "estimateUpdated", planId: plan.id });

    await expect(readTodayChange(goal.id)).resolves.toMatchObject({
      effect: { topicsLeftOut: [{ area: "Stocks" }] },
      id: change.id,
    });
  });

  it("stays off Today when every lesson still fits", async () => {
    const { goal, plan, user } = await pacedPlanFixture({
      dailyMinutes: 30,
      days: 14,
      lessons: 6,
      skills: 8,
    });

    await studyEveryLesson({ planId: plan.id, seconds: FASTER_SECONDS, userId: user.id });
    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
    await declineProposals({ goalId: goal.id, planId: plan.id });

    await expect(
      prisma.planChange.count({ where: { kind: "estimateUpdated", planId: plan.id } }),
    ).resolves.toBe(0);

    await expect(readTodayChange(goal.id)).resolves.toBeNull();
  });
});
