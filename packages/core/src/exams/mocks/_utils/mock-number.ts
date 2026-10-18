import "server-only";
import { prisma } from "@zoonk/db";

/**
 * How many mocks the learner finished for the goal before a mock was created (or before now), the
 * one count behind every mock number: "Mock exam 3" on the mock screen and in the exam's history
 * is the mock after two finished ones, and the exam's days take turns by it. A mock left
 * unfinished takes no number.
 */
export async function countFinishedMocksBefore({
  createdAt,
  goalId,
}: {
  /** The mock's creation; every finished mock counts without it. */
  createdAt?: Date;
  goalId: string | null;
}): Promise<number> {
  if (!goalId) {
    return 0;
  }

  return prisma.mockExam.count({
    where: { goalId, status: "finished", ...(createdAt && { createdAt: { lt: createdAt } }) },
  });
}
