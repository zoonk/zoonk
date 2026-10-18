import "server-only";
import { prisma } from "@zoonk/db";

/**
 * The lesson the goal's plan opens with: its first lesson still to do, which Day 1 opens. Null
 * while that item stands in for a skill whose lessons aren't outlined yet, or with no plan.
 */
export async function findPlanFirstLessonId(goalId: string): Promise<string | null> {
  const first = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  return first?.lessonId ?? null;
}
