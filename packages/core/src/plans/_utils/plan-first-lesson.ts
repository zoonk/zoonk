import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";

export async function findPlanFirstLessonId({
  db = prisma,
  goalId,
}: {
  db?: TransactionClient;
  goalId: string;
}): Promise<string | null> {
  const first = await db.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  return first?.lessonId ?? null;
}
