import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AHEAD_START } from "./_test-utils/ahead-plan";
import { declineProposals, pacedPlanFixture, studyEveryLesson } from "./_test-utils/estimate-plan";
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

describe("a closer estimate of how long lessons take", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHEAD_START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds no lesson by itself when a faster pace would fit more", async () => {
    const { goal, plan, user } = await pacedPlanFixture({
      dailyMinutes: 15,
      days: 14,
      lessons: 4,
      skills: 12,
    });

    const readLessons = async () => {
      const items = await prisma.planItem.findMany({ where: { kind: "lesson", planId: plan.id } });

      return items
        .map((item) => item.lessonId ?? item.skillId ?? "")
        .toSorted((left, right) => left.localeCompare(right));
    };

    const before = await readLessons();
    expect(before.length).toBeLessThan(12 * 4);

    await studyEveryLesson({ planId: plan.id, seconds: FASTER_SECONDS, userId: user.id });

    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
    await expect(readLessons()).resolves.toStrictEqual(before);

    await expect(
      prisma.planChange.count({ where: { kind: "estimateUpdated", planId: plan.id } }),
    ).resolves.toBe(0);
  });

  it("records how many fewer lessons fit by the date, and which", async () => {
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
    expect(change.effect).toMatchObject({ topicsLeftOut: [{ area: "Stocks" }] });
  });

  it("records nothing when every lesson still fits", async () => {
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
  });
});
