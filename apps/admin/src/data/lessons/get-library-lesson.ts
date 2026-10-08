import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const libraryLessonInclude = {
  _count: { select: { planItems: true, questionThreads: true, studyBlocks: true } },
  chapters: {
    include: {
      chapter: {
        select: {
          courses: { select: { course: { select: { id: true, title: true } }, level: true } },
          homeCourse: { select: { id: true, title: true } },
          id: true,
          title: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  homeChapter: {
    select: { homeCourse: { select: { id: true, title: true } }, id: true, title: true },
  },
  owner: { select: { email: true, id: true, name: true } },
  sentences: {
    include: { sentence: { select: { audioUrl: true, sentence: true } } },
    orderBy: { position: "asc" as const },
  },
  skills: { include: { skill: { select: { id: true, name: true } } } },
  steps: {
    include: {
      _count: { select: { answerExplanations: true, exampleLines: true, mistakes: true } },
      item: { select: { format: true, id: true } },
      mediaAsset: { select: { id: true, kind: true, url: true } },
      skill: { select: { id: true, name: true } },
      variants: { orderBy: [{ kind: "asc" as const }, { key: "asc" as const }] },
    },
    orderBy: { position: "asc" as const },
    where: { retiredAt: null },
  },
  words: {
    include: { word: { select: { audioUrl: true, word: true } } },
    orderBy: { position: "asc" as const },
  },
};

/**
 * Answers per screen, split by right and wrong, from learner rows. Attempts point at steps with
 * SetNull, so a rewritten lesson starts over at zero.
 */
async function countStepAnswers(stepIds: string[]) {
  const rows = await prisma.attempt.groupBy({
    _count: { id: true },
    by: ["stepId", "isCorrect"],
    where: { stepId: { in: stepIds } },
  });

  return rows.reduce((answers, row) => {
    const stepId = row.stepId ?? "";
    const current = answers.get(stepId) ?? { correct: 0, total: 0 };

    return answers.set(stepId, {
      correct: current.correct + (row.isCorrect ? row._count.id : 0),
      total: current.total + row._count.id,
    });
  }, new Map<string, { correct: number; total: number }>());
}

/**
 * Everything the admin lesson page shows about one Library lesson: where it's used, its skills,
 * spec and summary, each screen with its field and tool versions, and answers per screen.
 */
export const getLibraryLesson = cacheAdminData(async (lessonId: string) => {
  const lesson = await prisma.lesson.findUnique({
    include: libraryLessonInclude,
    where: { id: lessonId },
  });

  if (!lesson) {
    return null;
  }

  const answers = await countStepAnswers(lesson.steps.map((step) => step.id));

  return { answers, lesson };
});

export type LibraryLessonDetail = NonNullable<Awaited<ReturnType<typeof getLibraryLesson>>>;
export type LibraryLessonStep = LibraryLessonDetail["lesson"]["steps"][number];
