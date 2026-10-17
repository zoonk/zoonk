import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type DayBeforePlan } from "../../exams/view/exam-view-contract";
import { parsePlanPhases, parsePlanSettings } from "../planner/plan-state";
import { type ShortPlanDay, getShortPlanDay, getShortPlanShape } from "./short-plan-view";

/** Today in a short plan, with the day its short mock is scheduled (null without one). */
export type ShortPlanToday = ShortPlanDay & { mockDate: Date | null };

/**
 * The day before, from today's place in a short plan; the light review for any other plan. Its
 * short mock is a mock exam, which comes with Plus: without it, the day is the review alone.
 */
export function getDayBeforePlan({
  includesMockExams,
  shortPlan,
  today,
}: {
  includesMockExams: boolean;
  shortPlan: ShortPlanToday | null;
  today: Date;
}): DayBeforePlan {
  // A plan without mocks gives the mock's day to a full review of every topic.
  if (shortPlan?.focus === "mockAndReview") {
    return includesMockExams ? "mock" : "review";
  }

  if (shortPlan?.focus === "mapAndGaps") {
    const mockToday = includesMockExams && shortPlan.mockDate?.getTime() === today.getTime();
    return mockToday ? "learnAndMock" : "learn";
  }

  return "light";
}

type ShortPlanSource = {
  items: readonly { kind: string; scheduledFor: Date | null }[];
  phases: unknown;
  settings: unknown;
};

/**
 * Which day of a short plan today is, what it's for and when its short mock is: "Day 1 of 3: map
 * and gaps". Null for any plan that isn't a test days away, and outside its days.
 */
export async function loadShortPlanDay({
  goal,
  source,
  today,
}: {
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  /** A stale read uses its actual in-memory selection, not the older stored calendar. */
  source?: ShortPlanSource;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): Promise<ShortPlanToday | null> {
  if (goal.kind !== "exam" || !goal.targetDate) {
    return null;
  }

  const plan =
    source ??
    (await prisma.plan.findUnique({
      select: {
        items: {
          orderBy: { position: "asc" },
          select: { kind: true, scheduledFor: true },
          take: 1,
          where: { kind: "mock", scheduledFor: { not: null } },
        },
        phases: true,
        settings: true,
      },
      where: { goalId: goal.id },
    }));

  if (!plan) {
    return null;
  }

  const day = getShortPlanDay({
    phases: parsePlanPhases(plan.phases),
    shape: getShortPlanShape({ goal, settings: parsePlanSettings(plan.settings) }),
    today,
  });

  const mock = plan.items.find((item) => item.kind === "mock" && item.scheduledFor !== null);
  return day ? { ...day, mockDate: mock?.scheduledFor ?? null } : null;
}
