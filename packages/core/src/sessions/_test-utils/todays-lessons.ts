import { prisma } from "@zoonk/db";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";

/** The lessons the plan gives a day, including one it splits between that day and later ones. */
export async function loadDayLessonIds({
  goalId,
  today,
}: {
  goalId: string;
  today: string;
}): Promise<Set<string>> {
  const items = await prisma.planItem.findMany({
    where: { lessonId: { not: null }, plan: { goalId } },
  });

  const allocated = items.filter(
    (item) =>
      (item.scheduledFor !== null && toIsoDate(item.scheduledFor) <= today) ||
      readSelectedItemFacts(item.facts)?.days?.some(([date, , raw]) => date === today && raw > 0),
  );

  return new Set(allocated.flatMap((item) => item.lessonId ?? []));
}
