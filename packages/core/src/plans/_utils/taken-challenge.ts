import "server-only";
import { prisma } from "@zoonk/db";

/** Any finished attempt counts, won or lost: a lost challenge stays to do in the plan. */
export async function hasTakenChallenge({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<boolean> {
  const attempt = await prisma.learningEvent.findFirst({
    select: { id: true },
    where: { endedAt: { not: null }, goalId, kind: { in: ["checkpoint", "mock"] }, userId },
  });

  return attempt !== null;
}
