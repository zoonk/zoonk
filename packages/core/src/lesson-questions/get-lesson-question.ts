import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { lessonQuestionResourceOmit, toLessonQuestionResource } from "./_utils/question-resource";
import { findThreadSubject } from "./_utils/tutor-subject";

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
    include: { thread: true },
    omit: lessonQuestionResourceOmit,
    where: { id: questionId, thread: { userId: session.user.id } },
  });

  if (!question) {
    return { status: "notFound" as const };
  }

  const access = await findThreadSubject({ thread: question.thread, userId: session.user.id });

  if (access.status !== "ready") {
    return access;
  }

  return { question: toLessonQuestionResource(question), status: "ready" as const };
}
