import "server-only";
import { prisma } from "@zoonk/db";

export function loadPlanWindowItems({
  goalId,
  includeUnscheduledLessons,
}: {
  goalId: string;
  includeUnscheduledLessons: boolean;
}) {
  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: {
      chapterId: true,
      facts: true,
      kind: true,
      lessonId: true,
      scheduledFor: true,
      skillId: true,
    },
    where: {
      OR: [
        { lessonId: { not: null }, scheduledFor: { not: null } },
        ...(includeUnscheduledLessons ? [{ kind: "lesson" as const }] : []),
        { chapterId: null, kind: "lesson", lessonId: null, skillId: { not: null } },
      ],
      plan: { goalId },
      status: "todo",
    },
  });
}
