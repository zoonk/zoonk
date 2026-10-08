import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Whether the lesson is in one of the learner's plans: as a lesson of its own, or in a chapter the
 * plan studies whole. Reading those screens is studying, not browsing the Library.
 */
export async function isLessonInLearnerPlan({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<boolean> {
  const item = await prisma.planItem.findFirst({
    select: { id: true },
    where: {
      OR: [{ lessonId }, { chapter: { lessons: { some: { lessonId } } }, kind: "chapter" }],
      plan: { goal: { userId } },
    },
  });

  return item !== null;
}
