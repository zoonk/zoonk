import "server-only";
import { prisma } from "@zoonk/db";
import { toSlug } from "@zoonk/utils/string";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { type GoalOpeningSkill } from "../library/curriculum/opening-graph";
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

/** The lesson an earlier run of the goal picked, and the skill and course its chapter teaches. */
export type SavedGoalOpening = { lesson: OpeningLesson; skill: GoalOpeningSkill | null };

/**
 * Internal workflow bridge: the goal's run reads what an earlier run of it saved, so a retried run
 * writes the same graph start without writing the opening again.
 */
export async function readSavedGoalOpening(goalId: string): Promise<SavedGoalOpening | null> {
  const goal = await prisma.goal.findUnique({
    select: {
      openingLesson: {
        select: {
          homeChapter: {
            select: {
              _count: { select: { lessons: true } },
              courses: {
                orderBy: { createdAt: "asc" },
                select: { area: true, course: { select: { id: true, title: true } }, level: true },
                take: 1,
              },
              goalSkills: {
                orderBy: { createdAt: "asc" },
                select: {
                  skill: { select: { description: true, id: true, level: true, name: true } },
                },
                take: 1,
              },
            },
          },
          id: true,
          title: true,
        },
      },
    },
    where: { id: goalId },
  });

  const lesson = goal?.openingLesson;

  if (!lesson) {
    return null;
  }

  const [placement] = lesson.homeChapter?.courses ?? [];
  const [tagged] = lesson.homeChapter?.goalSkills ?? [];

  const skill: GoalOpeningSkill | null =
    placement && tagged
      ? {
          course: { ...placement.course, key: toSlug(placement.course.title) },
          skill: {
            area: placement.area ?? placement.course.title,
            description: tagged.skill.description,
            estimatedLessons: Math.max(lesson.homeChapter?._count.lessons ?? 0, 1),
            id: tagged.skill.id,
            key: toSlug(tagged.skill.name),
            level: tagged.skill.level ?? placement.level,
            name: tagged.skill.name,
          },
        }
      : null;

  return { lesson: { id: lesson.id, title: lesson.title }, skill };
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

  const goal = await prisma.goal.findUniqueOrThrow({
    select: { openingLesson: { select: { id: true, title: true } } },
    where: { id: goalId },
  });

  return goal.openingLesson;
}
