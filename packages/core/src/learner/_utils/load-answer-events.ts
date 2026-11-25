import "server-only";
import { DbNull, type TransactionClient, prisma } from "@zoonk/db";
import { NOT_LESSON_ANSWER_FILTER } from "@zoonk/db/lesson-answer";
import { isJsonObject } from "@zoonk/utils/json";
import { type ClaimEvent } from "./skill-claims";

const MAX_ANSWERS = 2000;

export async function loadAnswerEvents({
  skillIds,
  tx = prisma,
  userId,
}: {
  skillIds: readonly string[];
  tx?: TransactionClient;
  userId: string;
}): Promise<ClaimEvent[]> {
  const answers = await tx.attempt.findMany({
    orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
    select: {
      answer: true,
      answeredAt: true,
      isCorrect: true,
      isPlacement: true,
      item: { select: { content: true, format: true } },
      itemId: true,
      localDate: true,
      skillId: true,
      studySessionId: true,
    },
    take: MAX_ANSWERS,
    where: {
      AND: [
        { answer: { equals: DbNull, path: ["placementPending"] } },
        { answer: { equals: DbNull, path: ["practiceMistakeId"] } },
        { mockExamId: null },
      ],
      itemId: { not: null },
      skillId: { in: [...skillIds] },
      ...NOT_LESSON_ANSWER_FILTER,
      userId,
    },
  });

  return answers
    .toReversed()
    .flatMap((answer): ClaimEvent[] =>
      answer.skillId
        ? [
            {
              at: answer.answeredAt,
              content: answer.item?.content,
              format: answer.item?.format ?? "multipleChoice",
              isCorrect: answer.isCorrect,
              itemId: answer.itemId,
              kind: answer.studySessionId && !answer.isPlacement ? "practice" : "test",
              localDate: answer.localDate,
              recheck: isJsonObject(answer.answer) && answer.answer.placementRecheck === true,
              skillId: answer.skillId,
            },
          ]
        : [],
    );
}
