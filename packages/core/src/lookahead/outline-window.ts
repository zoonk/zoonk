import "server-only";
import { type Goal, type PlanItem, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { addDays } from "../plans/planner/plan-calendar";
import { isStandIn } from "../plans/planner/plan-item-rules";
import { isExamSchedule } from "../plans/planner/plan-queue";
import { getGoalDayMinutes } from "../sessions/_utils/day-minutes";

/** A long stand-in may start by `localDate` while its due date is later; detect its consumed interval. */
export async function loadNextStandIn({
  client = prisma,
  goal,
  localDate,
}: {
  client?: TransactionClient;
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  localDate: Date;
}): Promise<Pick<PlanItem, "id" | "skillId">[]> {
  if (isExamSchedule(goal)) {
    return [];
  }

  const plan = { goalId: goal.id };

  const [last, next] = await Promise.all([
    client.planItem.findFirst({
      orderBy: [{ scheduledFor: "desc" }, { position: "desc" }],
      select: { kind: true },
      where: { plan, scheduledFor: { lte: localDate }, status: "todo" },
    }),
    client.planItem.findFirst({
      orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
      select: { chapterId: true, id: true, kind: true, lessonId: true, skillId: true },
      where: { plan, scheduledFor: { gt: localDate }, status: "todo" },
    }),
  ]);

  return next && isStandIn(next) && last?.kind !== "boss" ? [next] : [];
}

/** Plan items due within `days` of the goal's local today and, on a study day, the stand-in the learner is on, as Today shows it. */
export async function getOutlineWindow({ days, goalId }: { days: number; goalId: string }) {
  const goal = await prisma.goal.findUnique({
    select: {
      dailyMinutes: true,
      id: true,
      kind: true,
      plan: { select: { settings: true } },
      targetDate: true,
      timezone: true,
    },
    where: { id: goalId },
  });

  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  const dueBy = { scheduledFor: { lte: addDays(today, days) } };

  if (!goal || getGoalDayMinutes({ date: today, goal, planSettings: goal.plan?.settings }) === 0) {
    return dueBy;
  }

  const [current] = await loadNextStandIn({ goal, localDate: today });
  return current ? { OR: [dueBy, { id: current.id }] } : dueBy;
}

export type OutlineWindow = Awaited<ReturnType<typeof getOutlineWindow>>;
