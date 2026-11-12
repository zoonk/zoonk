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
  stopped,
}: {
  finished: boolean;
  written: boolean;
  stopped: boolean;
}): OnboardingFirstLesson["status"] {
  if (finished) {
    return "done";
  }

  if (written) {
    return "ready";
  }

  return stopped ? "stopped" : "writing";
}

/**
 * Internal: authorize the goal first; `userId` is its owner's.
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

  if (!lesson) {
    return null;
  }

  return {
    id: lesson.id,
    status: getOpeningStatus({
      finished,
      stopped: lesson.contentStatus === "failed" || lesson.setAsideAt !== null,
      written: lesson.contentStatus === "completed",
    }),
    title: lesson.title,
  };
}

/** The lesson, skill and course an earlier run of the goal picked. */
export type SavedGoalOpening = { lesson: OpeningLesson; skill: GoalOpeningSkill };

/** An opening picked for another country belongs to the goal's old content, so no run reuses it. */
async function findSavedOpening(
  goalId: string,
  country: string | null,
): Promise<{ lessonId: string | null; saved: SavedGoalOpening | null }> {
  const goal = await prisma.goal.findUnique({
    select: { openingLesson: { select: { id: true, title: true } }, openingSkill: true },
    where: { id: goalId },
  });

  const lesson = goal?.openingLesson;

  if (!lesson) {
    return { lessonId: null, saved: null };
  }

  const skill = goalOpeningSkillSchema.parse(goal.openingSkill);

  const course = await prisma.course.findFirst({
    select: { country: true },
    where: { id: skill.course.id },
  });

  const countrySpecific = Boolean(course?.country) || skill.course.countrySpecific;
  const fits = course && course.country === (countrySpecific ? country : null);

  return {
    lessonId: lesson.id,
    saved: fits
      ? { lesson, skill: { ...skill, course: { ...skill.course, countrySpecific } } }
      : null,
  };
}

/**
 * Internal workflow bridge: the goal's run reads what an earlier run of it saved for the same
 * content country, so a retried run writes the same graph start without writing the opening again.
 */
export async function readSavedGoalOpening(
  goalId: string,
  country: string | null,
): Promise<SavedGoalOpening | null> {
  const { saved } = await findSavedOpening(goalId, country);
  return saved;
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
 * Internal workflow bridge: `goalId` must come from the goal's own run. The first lesson saved for
 * the country stays the goal's, so a retried or repeated run opens the same one; one saved for
 * another country is replaced.
 */
export async function saveGoalOpening({
  country,
  goalId,
  lessonId,
  opening,
}: {
  country: string | null;
  goalId: string;
  lessonId: string;
  opening: GoalOpeningSkill;
}): Promise<OpeningLesson | null> {
  const found = await findSavedOpening(goalId, country);

  if (found.saved) {
    return found.saved.lesson;
  }

  await prisma.goal.updateMany({
    data: { openingLessonId: lessonId, openingSkill: opening },
    where: { id: goalId, openingLessonId: found.lessonId },
  });

  const goal = await prisma.goal.findUniqueOrThrow({
    select: { openingLesson: { select: { id: true, title: true } } },
    where: { id: goalId },
  });

  return goal.openingLesson;
}
