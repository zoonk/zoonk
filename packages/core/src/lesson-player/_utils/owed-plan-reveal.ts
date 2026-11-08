import "server-only";
import { prisma } from "@zoonk/db";
import { readPlanReadiness } from "../../plans/_utils/plan-readiness";
import { type LibraryLessonCompletion } from "../contract";

/** Internal: `userId` comes from the session. A learner who started with this lesson sees their plan next. */
export async function findOwedPlanReveal({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<LibraryLessonCompletion["planReveal"]> {
  const goal = await prisma.goal.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
    where: { openingLessonId: lessonId, planRevealedAt: null, status: "active", userId },
  });

  if (!goal) {
    return null;
  }

  const readiness = await readPlanReadiness(goal.id);
  return { goalId: goal.id, goalTitle: goal.title, planReady: readiness?.ready ?? false };
}
