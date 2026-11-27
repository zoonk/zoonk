import "server-only";
import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";

export function findPracticeMock({ mockId, userId }: { mockId: string; userId: string }) {
  return isUuid(mockId)
    ? prisma.mockExam.findFirst({
        select: { goal: true },
        where: { id: mockId, status: "finished", userId },
      })
    : null;
}

/** A later mock miss may have reused an entry whose source attempt belongs elsewhere. */
export async function mockMistakeWhere({ mockId, userId }: { mockId: string; userId: string }) {
  const attempts = await prisma.attempt.findMany({
    select: { answer: true },
    where: { isCorrect: false, mockExamId: mockId, userId },
  });

  return {
    AND: [
      {
        OR: [
          { attempt: { mockExamId: mockId } },
          {
            id: { in: attempts.flatMap(({ answer }) => getString(answer, "mockMistakeId") ?? []) },
          },
        ],
      },
    ],
    userId,
  };
}
