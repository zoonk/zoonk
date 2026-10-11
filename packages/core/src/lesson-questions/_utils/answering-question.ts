import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { findThreadSubject } from "./tutor-subject";
import { findSubjectGoal } from "./tutored-goal";

/**
 * The goal whose plan the buddy's answer may propose a change to or offer the app's features for:
 * the goal of the thread whose answer this generation is still writing, in any of the learner's
 * threads inside one of their goals (its own conversation, a chapter, a lesson or a mock). Null
 * for any other answer.
 */
export async function findAnsweringGoal({
  questionId,
  revision,
  userId,
}: {
  questionId: string;
  revision: number;
  userId: string;
}): Promise<Goal | null> {
  const question = await prisma.lessonQuestion.findFirst({
    select: { thread: true },
    where: { generationRevision: revision, id: questionId, status: "running", thread: { userId } },
  });

  const access = question ? await findThreadSubject({ thread: question.thread, userId }) : null;

  return access?.status === "ready" ? findSubjectGoal({ subject: access.subject, userId }) : null;
}
