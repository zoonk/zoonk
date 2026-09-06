import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { getLessonQuestionAccess } from "./_utils/question-access";
import { lessonQuestionResourceOmit, toLessonQuestionResource } from "./_utils/question-resource";

/** Returns one current learner-owned question without loading its large immutable AI snapshot. */
export async function getLessonQuestion({ questionId }: { questionId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(questionId)) {
    return { status: "notFound" as const };
  }

  const question = await prisma.lessonQuestion.findFirst({
    include: { thread: { select: { lessonId: true } } },
    omit: lessonQuestionResourceOmit,
    where: { id: questionId, thread: { userId: session.user.id } },
  });

  if (!question?.thread.lessonId) {
    return { status: "notFound" as const };
  }

  const access = await getLessonQuestionAccess({
    lessonId: question.thread.lessonId,
    userId: session.user.id,
  });

  if (access.status !== "ready") {
    return access;
  }

  return { question: toLessonQuestionResource(question), status: "ready" as const };
}
