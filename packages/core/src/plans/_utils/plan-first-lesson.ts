import "server-only";
import { prisma } from "@zoonk/db";

export async function findPlanFirstLessonId(goalId: string): Promise<string | null> {
  const first = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  return first?.lessonId ?? null;
}
