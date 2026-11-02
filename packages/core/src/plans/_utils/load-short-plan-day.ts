import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type DayBeforePlan } from "../../exams/view/exam-view-contract";
import { parsePlanPhases, parsePlanSettings } from "../planner/plan-state";
import { type ShortPlanDay, getShortPlanDay, getShortPlanShape } from "./short-plan-view";

export type ShortPlanToday = ShortPlanDay & { mockDate: Date | null };

export function getDayBeforePlan({
  includesMockExams,
  shortPlan,
  today,
}: {
  includesMockExams: boolean;
  shortPlan: ShortPlanToday | null;
  today: Date;
}): DayBeforePlan {
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

export async function loadShortPlanDay({
  goal,
  source,
  today,
}: {
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  source?: ShortPlanSource;
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
