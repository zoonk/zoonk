import "server-only";
import { type CallReuse } from "@zoonk/ai/provider-options";
import { prisma } from "@zoonk/db";
import { getContentReuse } from "../curriculum/curriculum-scope";
import { lessonGoalsFilter } from "../sources/goal-material";

type GoalFilter = ReturnType<typeof lessonGoalsFilter>;

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
