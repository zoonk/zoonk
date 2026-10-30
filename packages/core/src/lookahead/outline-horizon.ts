import "server-only";
import { type Goal, type PlanItem, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { addDays } from "../plans/planner/plan-calendar";
import { isStandIn } from "../plans/planner/plan-item-rules";
import { isExamSchedule } from "../plans/planner/plan-queue";

/** A long stand-in may start by `localDate` while its due date is later; detect its consumed interval. */
export async function loadNextStandIn({
  client = prisma,
  goal,
  localDate,
}: {
  client?: TransactionClient;
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  localDate: Date;
}): Promise<Pick<PlanItem, "scheduledFor" | "skillId">[]> {
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
      select: { chapterId: true, kind: true, lessonId: true, scheduledFor: true, skillId: true },
      where: { plan, scheduledFor: { gt: localDate }, status: "todo" },
    }),
  ]);

  return next && isStandIn(next) && last?.kind !== "boss" ? [next] : [];
}

/** `days` after the goal's local today, or through the end of the stand-in the learner is on when it runs longer. */
export async function getOutlineHorizon({
  days,
  goalId,
}: {
  days: number;
  goalId: string;
}): Promise<Date> {
  const goal = await prisma.goal.findUnique({
    select: { id: true, kind: true, targetDate: true, timezone: true },
    where: { id: goalId },
  });

  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  const horizon = addDays(today, days);
  const [current] = goal ? await loadNextStandIn({ goal, localDate: today }) : [];
  const currentEnd = current?.scheduledFor;

  return currentEnd && currentEnd > horizon ? currentEnd : horizon;
}
