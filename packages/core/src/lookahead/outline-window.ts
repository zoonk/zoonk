import "server-only";
import { type PlanItem, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { readSelectedItemFacts } from "../plans/_utils/selected-item-contract";
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

/** Stand-ins due after `until` that take time on a day from `today` to `until`. */
async function listStandInsStartingBy({
  goalId,
  today,
  until,
}: {
  goalId: string;
  today: Date;
  until: Date;
}): Promise<string[]> {
  const items = await prisma.planItem.findMany({
    select: { facts: true, id: true },
    where: {
      OR: [{ scheduledFor: { gt: until } }, { scheduledFor: null }],
      chapterId: null,
      kind: "lesson",
      lessonId: null,
      plan: { goalId },
      skillId: { not: null },
      status: "todo",
    },
  });

  const [from, to] = [toIsoDate(today), toIsoDate(until)];

  return items.flatMap((item) =>
    readSelectedItemFacts(item.facts)?.days?.some(
      ([day, , raw]) => day >= from && day <= to && raw > 0,
    )
      ? [item.id]
      : [],
  );
}

/** Plan items due within `days` of the goal's local today, and the stand-ins that take time in those days. */
export async function getOutlineWindow({ days, goalId }: { days: number; goalId: string }) {
  const goal = await prisma.goal.findUnique({ select: { timezone: true }, where: { id: goalId } });
  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  const until = addDays(today, days);
  const dueBy = { scheduledFor: { lte: until } };
  const started = await listStandInsStartingBy({ goalId, today, until });

  return started.length > 0 ? { OR: [dueBy, { id: { in: started } }] } : dueBy;
}

export type OutlineWindow = Awaited<ReturnType<typeof getOutlineWindow>>;
