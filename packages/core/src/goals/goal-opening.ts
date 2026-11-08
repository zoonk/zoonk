import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { type OnboardingFirstLesson } from "../view-models/onboarding/onboarding-contract";

type OpeningLesson = { id: string; title: string };

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

/** Internal workflow bridge: the goal's run reads what an earlier run of it already picked. */
export async function readGoalOpeningLesson(goalId: string): Promise<OpeningLesson | null> {
  const goal = await prisma.goal.findUnique({
    select: { openingLesson: { select: { id: true, title: true } } },
    where: { id: goalId },
  });

  return goal?.openingLesson ?? null;
}

/**
 * Internal workflow bridge: the first lesson the course already teaches the skill in, for a subject
 * other learners started, so the learner's first lesson is one the Library has.
 */
export async function findOpeningLesson({
  courseId,
  skillId,
  userId,
}: {
  courseId: string;
  skillId: string;
  userId: string;
}): Promise<string | null> {
  const visible = libraryRowsVisibleTo(userId);

  const placement = await prisma.courseChapter.findFirst({
    orderBy: [{ level: "asc" }, { position: "asc" }],
    select: { chapterId: true },
    where: {
      chapter: {
        is: { ...visible, goalSkills: { some: { skillId } }, outlineStatus: "completed" },
      },
      courseId,
    },
  });

  if (!placement) {
    return null;
  }

  const first = await prisma.chapterLesson.findFirst({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    where: { chapterId: placement.chapterId, lesson: { ...visible, setAsideAt: null } },
  });

  return first?.lessonId ?? null;
}

/**
 * Internal workflow bridge: `goalId` must come from the goal's own run. The first lesson saved
 * stays the goal's, so a retried or repeated run opens the same one.
 */
export async function saveGoalOpening({
  goalId,
  lessonId,
}: {
  goalId: string;
  lessonId: string;
}): Promise<OpeningLesson | null> {
  await prisma.goal.updateMany({
    data: { openingLessonId: lessonId },
    where: { id: goalId, openingLessonId: null },
  });

  return readGoalOpeningLesson(goalId);
}
