import "server-only";
import { prisma } from "@zoonk/db";

export function loadCapsuleHistory({
  itemIds,
  sessionId,
  userId,
}: {
  itemIds: readonly string[];
  sessionId: string;
  userId: string;
}) {
  return prisma.attempt.findMany({
    distinct: ["itemId"],
    orderBy: [{ itemId: "asc" }, { answeredAt: "desc" }],
    select: { answer: true, answeredAt: true, isCorrect: true, itemId: true },
    where: {
      OR: [{ studySessionId: null }, { studySessionId: { not: sessionId } }],
      itemId: { in: [...itemIds] },
      userId,
    },
  });
}
