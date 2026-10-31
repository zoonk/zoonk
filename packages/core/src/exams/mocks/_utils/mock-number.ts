import "server-only";
import { prisma } from "@zoonk/db";

export async function countFinishedMocksBefore({
  createdAt,
  goalId,
}: {
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
