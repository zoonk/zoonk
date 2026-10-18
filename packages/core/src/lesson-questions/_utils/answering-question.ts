import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { findThreadSubject } from "./tutor-subject";

/**
 * The goal whose plan the buddy's answer may look up, propose a change to or offer the app's
 * features for: the goal the question was asked under, as it saved it (its own conversation's, or
 * the goal a chapter, lesson or mock belonged to then), while this generation is still writing the
 * learner's answer in a thread they can still open. Never the goal open now: an answer stays on
 * its goal when the learner opens another mid-answer, and only while that goal is still theirs.
 * Null for any other answer, and for a question asked without a goal (or before it was saved).
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
