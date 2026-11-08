import "server-only";
import { prisma } from "@zoonk/db";
import { hasFinishedLesson } from "../lesson-player/_utils/lesson-runs";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { type GoalOpeningSkill, goalOpeningSkillSchema } from "../library/curriculum/opening-graph";
import { type OnboardingFirstLesson } from "../view-models/onboarding/onboarding-contract";

type OpeningLesson = { id: string; title: string };

function getOpeningStatus({
  finished,
  written,
}: {
  finished: boolean;
  written: boolean;
}): OnboardingFirstLesson["status"] {
  if (finished) {
    return "done";
  }

  return written ? "ready" : "writing";
}

/**
 * Internal: authorize the goal first; `userId` is its owner's. A lesson no run will write again is
 * no lesson to offer.
 */
export async function readGoalOpening({
  lessonId,
  userId,
}: {
  lessonId: string | null;
  userId: string;
}): Promise<OnboardingFirstLesson | null> {
  if (!lessonId) {
    return null;
  }

  const [lesson, finished] = await Promise.all([
    prisma.lesson.findUnique({
      select: { contentStatus: true, id: true, setAsideAt: true, title: true },
      where: { id: lessonId },
    }),
    hasFinishedLesson({ lessonId, userId }),
  ]);

  if (!lesson || lesson.setAsideAt) {
    return null;
  }

  return {
    id: lesson.id,
    status: getOpeningStatus({ finished, written: lesson.contentStatus === "completed" }),
    title: lesson.title,
  };
}

/** The lesson, skill and course an earlier run of the goal picked. */
export type SavedGoalOpening = { lesson: OpeningLesson; skill: GoalOpeningSkill };

/**
 * Internal workflow bridge: the goal's run reads what an earlier run of it saved, so a retried run
 * writes the same graph start without writing the opening again.
 */
export async function readSavedGoalOpening(goalId: string): Promise<SavedGoalOpening | null> {
  const goal = await prisma.goal.findUnique({
    select: { openingLesson: { select: { id: true, title: true } }, openingSkill: true },
    where: { id: goalId },
  });

  const lesson = goal?.openingLesson;

  if (!lesson) {
    return null;
  }

  return { lesson, skill: goalOpeningSkillSchema.parse(goal.openingSkill) };
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
  opening,
}: {
  goalId: string;
  lessonId: string;
  opening: GoalOpeningSkill;
}): Promise<OpeningLesson | null> {
  await prisma.goal.updateMany({
    data: { openingLessonId: lessonId, openingSkill: opening },
    where: { id: goalId, openingLessonId: null },
  });

  const goal = await prisma.goal.findUniqueOrThrow({
    select: { openingLesson: { select: { id: true, title: true } } },
    where: { id: goalId },
  });

  return goal.openingLesson;
}
