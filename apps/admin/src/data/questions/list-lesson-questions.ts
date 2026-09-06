import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { lessonQuestionReviewInclude } from "./_utils/lesson-question-review-include";

const cachedListLessonQuestions = cacheAdminData(
  async (limit: number, offset: number, search?: string) => {
    const where = getLessonQuestionSearchWhere({ search });

    const [questions, total] = await Promise.all([
      prisma.lessonQuestion.findMany({
        include: lessonQuestionReviewInclude,
        omit: { contextSnapshot: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.lessonQuestion.count({ where }),
    ]);

    return { questions, total };
  },
);

export async function listLessonQuestions({
  limit,
  offset,
  search,
}: {
  limit: number;
  offset: number;
  search?: string;
}) {
  return cachedListLessonQuestions(limit, offset, search);
}

function getLessonQuestionSearchWhere({ search }: { search?: string }) {
  if (!search) {
    return;
  }

  const containsSearch = { contains: search, mode: "insensitive" as const };

  return {
    OR: [
      { question: containsSearch },
      { answer: containsSearch },
      { thread: { user: { name: containsSearch } } },
      { thread: { user: { email: containsSearch } } },
      { thread: { user: { username: containsSearch } } },
      { thread: { lesson: { normalizedTitle: containsSearch } } },
      { thread: { lesson: { chapter: { normalizedTitle: containsSearch } } } },
      { thread: { lesson: { chapter: { course: { normalizedTitle: containsSearch } } } } },
    ],
  };
}

export type ListedLessonQuestion = Awaited<
  ReturnType<typeof listLessonQuestions>
>["questions"][number];
