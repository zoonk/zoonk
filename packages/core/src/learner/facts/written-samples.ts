import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { writtenAnswerSchema, writtenItemSchema } from "../../exams/essays/writing-contract";
import { isNumericWritingRubric } from "../../exams/essays/writing-rubric-policy";

export async function readWrittenSamples({ goalId, userId }: { goalId: string; userId: string }) {
  "use cache: private";

  cacheTag(getLearnerModelCacheTag(userId));

  const attempts = await prisma.attempt.findMany({
    orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
    select: {
      answer: true,
      id: true,
      item: { select: { content: true } },
      itemId: true,
      localDate: true,
      mockExamId: true,
      studySessionId: true,
    },
    where: {
      OR: [
        { mockExam: { goalId, status: "finished", userId } },
        { mockExamId: null, studySession: { goalId, userId } },
      ],
      item: { format: "essay" },
      userId,
    },
  });

  return attempts.flatMap((attempt) => {
    const { itemId } = attempt;
    const answer = writtenAnswerSchema.safeParse(attempt.answer).data;
    const content = attempt.item?.content;
    const prompt = writtenItemSchema.safeParse(isJsonObject(content) ? content.writing : null).data;
    const origin = attempt.mockExamId ? "mock" : "block";

    return answer && prompt && itemId && answer.conditions.origin === origin
      ? [{ ...attempt, answer, itemId, numericEligible: isNumericWritingRubric(prompt), prompt }]
      : [];
  });
}

export type WrittenSample = Awaited<ReturnType<typeof readWrittenSamples>>[number];
