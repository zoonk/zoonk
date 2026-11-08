import "server-only";
import { prisma } from "@zoonk/db";
import { type OnboardingFirstLesson } from "../view-models/onboarding/onboarding-contract";

/** Internal: authorize the goal first. A lesson no run will write again is no lesson to offer. */
export async function readGoalOpening(
  openingLessonId: string | null,
): Promise<OnboardingFirstLesson | null> {
  if (!openingLessonId) {
    return null;
  }

  const lesson = await prisma.lesson.findUnique({
    select: { contentStatus: true, id: true, setAsideAt: true, title: true },
    where: { id: openingLessonId },
  });

  if (!lesson || lesson.setAsideAt) {
    return null;
  }

  return {
    id: lesson.id,
    status: lesson.contentStatus === "completed" ? "ready" : "writing",
    title: lesson.title,
  };
}
