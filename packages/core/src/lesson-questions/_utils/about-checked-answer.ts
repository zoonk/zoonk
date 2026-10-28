import "server-only";
import { AnyNull, type LessonQuestionWhereInput, type TransactionClient, prisma } from "@zoonk/db";

/** Checked-answer turns stay hidden during hint-only reattempts to avoid revealing previous solutions. */
export const aboutCheckedAnswerWhere = {
  OR: [
    { contextKind: "answer" },
    { contextKind: "item", contextSnapshot: { not: AnyNull, path: ["screen", "answer"] } },
  ],
} satisfies LessonQuestionWhereInput;

export async function findAboutCheckedAnswer({
  client = prisma,
  questionIds,
}: {
  client?: TransactionClient;
  questionIds: string[];
}): Promise<ReadonlySet<string>> {
  if (questionIds.length === 0) {
    return new Set();
  }

  const questions = await client.lessonQuestion.findMany({
    select: { id: true },
    where: { AND: [aboutCheckedAnswerWhere], id: { in: questionIds } },
  });

  return new Set(questions.map((question) => question.id));
}
