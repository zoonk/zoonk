import "server-only";
import { type CallReuse } from "@zoonk/ai/provider-options";
import { prisma } from "@zoonk/db";
import { getContentReuse } from "../curriculum/curriculum-scope";
import { lessonGoalsFilter } from "../sources/goal-material";

type GoalFilter = ReturnType<typeof lessonGoalsFilter>;

/**
 * Whether goals of two different learners already plan a shared lesson, its chapter or its
 * course: a popular shared course's lesson, read again once it's written.
 */
async function hasSeveralLearners(goals: GoalFilter): Promise<boolean> {
  const first = await prisma.goal.findFirst({ select: { userId: true }, where: goals });

  if (!first) {
    return false;
  }

  const other = await prisma.goal.findFirst({
    select: { id: true },
    where: { ...goals, userId: { not: first.userId } },
  });

  return other !== null;
}

/**
 * Who reuses a lesson once it's written (`CallReuse`), which sets the tier its spec and writing run
 * at and its reviewer (`getLessonCheckModels`): a private lesson serves its owner; a shared one is
 * very likely read again when it's a language's or an exam's (`forExam`, or an exam goal plans
 * it), or when other learners' goals already plan it (a popular shared course's); any other shared
 * lesson, a niche goal's, may serve one learner only.
 *
 * This is a workflow bridge: the lesson id comes from the workflow writing or checking it.
 */
export async function loadLessonReuse({
  forExam = false,
  lessonId,
}: {
  forExam?: boolean;
  lessonId: string;
}): Promise<CallReuse> {
  const lesson = await prisma.lesson.findUnique({
    select: {
      homeChapter: { select: { homeCourseId: true } },
      homeChapterId: true,
      ownerId: true,
      targetLanguage: true,
    },
    where: { id: lessonId },
  });

  if (!lesson) {
    return "library";
  }

  const reuse = getContentReuse({
    forExam,
    ownerId: lesson.ownerId,
    targetLanguage: lesson.targetLanguage,
  });

  if (reuse !== "library") {
    return reuse;
  }

  const goals = lessonGoalsFilter({
    chapterId: lesson.homeChapterId,
    courseId: lesson.homeChapter?.homeCourseId ?? null,
    lessonId,
  });

  const [examGoal, several] = await Promise.all([
    prisma.goal.findFirst({ select: { id: true }, where: { ...goals, kind: "exam" } }),
    hasSeveralLearners(goals),
  ]);

  return examGoal || several ? "bounded" : "library";
}
