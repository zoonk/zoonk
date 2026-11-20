import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";
import { writingAttemptSchema } from "./essay-contract";
import { writtenAnswerSchema } from "./writing-contract";

export async function getWritingAttempt(attemptId: string) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" } as const;
  }

  const attempt = isUuid(attemptId)
    ? await prisma.attempt.findFirst({
        select: { answer: true, answeredAt: true, item: { select: { content: true } } },
        where: { id: attemptId, userId: session.user.id },
      })
    : null;

  if (!attempt) {
    return { status: "notFound" } as const;
  }

  const answer = writtenAnswerSchema.safeParse(attempt.answer).data;
  const content = attempt.item?.content;

  const writing =
    content && typeof content === "object" && "writing" in content ? content.writing : null;

  const result =
    answer &&
    writingAttemptSchema.safeParse({
      attemptId,
      grade: answer.grade,
      submittedAt: attempt.answeredAt.toISOString(),
      text: answer.text,
      writing,
    }).data;

  return result
    ? ({ attempt: result, status: "ready" } as const)
    : ({ status: "notFound" } as const);
}
