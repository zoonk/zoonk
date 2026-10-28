import "server-only";
import { prisma } from "@zoonk/db";

export async function hasStudyGoal(userId: string): Promise<boolean> {
  const goal = await prisma.goal.findFirst({
    select: { id: true },
    where: { kind: { not: "explain" }, status: { not: "archived" }, userId },
  });

  return goal !== null;
}
