import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";
import { writingAttemptSchema } from "./essay-contract";
import { readWritingPrompt, writtenAnswerSchema } from "./writing-contract";

export async function getWritingAttempt(attemptId: string) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" } as const;
  }

  const attempt = isUuid(attemptId)
    ? await prisma.attempt.findFirst({
        select: { answer: true, answeredAt: true },
        where: { id: attemptId, userId: session.user.id },
      })
    : null;

  if (!attempt) {
    return { status: "notFound" } as const;
  }

  const answer = writtenAnswerSchema.safeParse(attempt.answer).data;

  if (!answer) {
    return { status: "notFound" } as const;
  }

  const result = writingAttemptSchema.parse({
    attemptId,
    grade: answer.grade,
    submittedAt: attempt.answeredAt.toISOString(),
    text: answer.text,
    writing: readWritingPrompt(answer.writing),
    ...(answer.writingTask && { writingTask: answer.writingTask }),
  });

  return { attempt: result, status: "ready" } as const;
}
