import "server-only";
import { prisma } from "@zoonk/db";

/**
 * The buddy's answer still being written by this generation, in the learner's own conversation
 * about one of their goals: what may propose a plan change or offer one of the app's tools.
 */
export function findAnsweringQuestion({
  questionId,
  revision,
  userId,
}: {
  questionId: string;
  revision: number;
  userId: string;
}) {
  return prisma.lessonQuestion.findFirst({
    select: { thread: { select: { goalId: true } } },
    where: {
      generationRevision: revision,
      id: questionId,
      status: "running",
      thread: { kind: "plan", userId },
    },
  });
}
