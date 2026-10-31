import "server-only";
import { prisma } from "@zoonk/db";

export async function isMemoryEnabled(userId: string): Promise<boolean> {
  const profile = await prisma.userLearningProfile.findUnique({
    select: { memoryEnabled: true },
    where: { userId },
  });

  return profile?.memoryEnabled ?? true;
}
