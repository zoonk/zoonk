import "server-only";
import { AnyNull, type LessonQuestionWhereInput, type TransactionClient, prisma } from "@zoonk/db";

/**
 * Questions asked about an answer the learner checked, so the tutor saw it and the right one: a
 * lesson's screen asked about its answer, or a session's or practice's question asked once it was
 * checked, whose snapshot holds the learner's answer (`screen.answer`, null before the check).
 * Before a question is checked the tutor only gives hints, so these wait until it's checked again.
 */
export const aboutCheckedAnswerWhere = {
  OR: [
    { contextKind: "answer" },
    { contextKind: "item", contextSnapshot: { not: AnyNull, path: ["screen", "answer"] } },
  ],
} satisfies LessonQuestionWhereInput;

/** Which of these questions were asked about an answer the learner checked. */
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
