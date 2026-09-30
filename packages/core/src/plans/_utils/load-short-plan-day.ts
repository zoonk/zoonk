import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type DayBeforePlan } from "../../exams/view/exam-view-contract";
import { parsePlanPhases, parsePlanSettings } from "../planner/plan-state";
import { type ShortPlanDay, getShortPlanDay, getShortPlanShape } from "./short-plan-view";

/** Today in a short plan, with the day its short mock is scheduled (null without one). */
export type ShortPlanToday = ShortPlanDay & { mockDate: Date | null };

/** The day before, from today's place in a short plan; the light review for any other plan. */
export function getDayBeforePlan({
  shortPlan,
  today,
}: {
  shortPlan: ShortPlanToday | null;
  today: Date;
}): DayBeforePlan {
  if (shortPlan?.focus === "mockAndReview") {
    return "mock";
  }

  if (shortPlan?.focus === "mapAndGaps") {
    return shortPlan.mockDate?.getTime() === today.getTime() ? "learnAndMock" : "learn";
  }

  return "light";
}

/**
 * Which day of a short plan today is, what it's for and when its short mock is: "Day 1 of 3: map
 * and gaps". Null for any plan that isn't a test days away, and outside its days.
 */
export async function loadShortPlanDay({
  goal,
  today,
}: {
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): Promise<ShortPlanToday | null> {
  if (goal.kind !== "exam" || !goal.targetDate) {
    return null;
  }

  const plan = await prisma.plan.findUnique({
    select: {
      items: {
        orderBy: { position: "asc" },
        select: { scheduledFor: true },
        take: 1,
        where: { kind: "mock", scheduledFor: { not: null } },
      },
      phases: true,
      settings: true,
    },
    where: { goalId: goal.id },
  });

  if (!plan) {
    return null;
  }

  const day = getShortPlanDay({
    phases: parsePlanPhases(plan.phases),
    shape: getShortPlanShape({ goal, settings: parsePlanSettings(plan.settings) }),
    today,
  });

  return day ? { ...day, mockDate: plan.items[0]?.scheduledFor ?? null } : null;
}
