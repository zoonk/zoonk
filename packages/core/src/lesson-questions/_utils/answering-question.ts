import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { findThreadSubject } from "./tutor-subject";

/** Uses only the question's saved goal while this revision still answers an accessible thread; never follows a goal switch. */
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
    select: { goalId: true, thread: true },
    where: { generationRevision: revision, id: questionId, status: "running", thread: { userId } },
  });

  if (!question?.goalId) {
    return null;
  }

  const [access, goal] = await Promise.all([
    findThreadSubject({ thread: question.thread, userId }),
    prisma.goal.findFirst({ where: { id: question.goalId, userId } }),
  ]);

  return access.status === "ready" ? goal : null;
}
