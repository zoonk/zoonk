import "server-only";
import { type PlanItem, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { addDays, toIsoDate } from "../plans/planner/plan-calendar";
import { isAllocatedOn } from "../sessions/_utils/day-lessons";

/** A long stand-in is due on the last day it spans, so its `facts.days` say which days it takes. */
export async function listDayStandIns({
  client = prisma,
  goalId,
  localDate,
}: {
  client?: TransactionClient;
  goalId: string;
  localDate: Date;
}): Promise<Pick<PlanItem, "id" | "skillId">[]> {
  const items = await client.planItem.findMany({
    select: { facts: true, id: true, scheduledFor: true, skillId: true },
    where: {
      OR: [
        { scheduledFor: { lte: localDate } },
        { facts: { array_contains: [[toIsoDate(localDate)]], path: ["days"] } },
      ],
      chapterId: null,
      kind: "lesson",
      lessonId: null,
      plan: { goalId },
      skillId: { not: null },
      status: "todo",
    },
  });

  return items.filter((item) => isAllocatedOn({ item, today: localDate }));
}

/** Plan items due within `days` of the goal's local today and the stand-ins today takes time for, as Today shows them. */
export async function getOutlineWindow({ days, goalId }: { days: number; goalId: string }) {
  const goal = await prisma.goal.findUnique({ select: { timezone: true }, where: { id: goalId } });
  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  const dueBy = { scheduledFor: { lte: addDays(today, days) } };
  const current = await listDayStandIns({ goalId, localDate: today });

  return current.length > 0
    ? { OR: [dueBy, { id: { in: current.map((item) => item.id) } }] }
    : dueBy;
}

export type OutlineWindow = Awaited<ReturnType<typeof getOutlineWindow>>;
