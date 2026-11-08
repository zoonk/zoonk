import "server-only";
import { type ServedSpeed } from "@zoonk/ai/provider-options";
import { prisma } from "@zoonk/db";

export async function getLessonWriterSpeed({
  goalId,
  lessonId,
}: {
  goalId?: string;
  lessonId: string;
}): Promise<ServedSpeed | undefined> {
  if (!goalId) {
    return undefined;
  }

  const goal = await prisma.goal.findFirst({
    select: {
      openingLessonId: true,
      plan: {
        select: {
          items: {
            orderBy: { position: "asc" },
            select: { lessonId: true },
            take: 1,
            where: { kind: "lesson", status: "todo" },
          },
        },
      },
    },
    where: { id: goalId, plan: { items: { none: { kind: "lesson", status: "done" } } } },
  });

  const firstLessonId = goal?.plan?.items[0]?.lessonId ?? goal?.openingLessonId;
  return firstLessonId === lessonId ? "fast" : undefined;
}
