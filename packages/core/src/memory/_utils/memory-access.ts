import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Whether memory is on for one learner: the switch in Settings, on until they turn it off. While
 * it's off nothing new is learned and tasks read nothing. Callers derive `userId` from the session
 * or from a workflow a session started.
 */
export async function isMemoryEnabled(userId: string): Promise<boolean> {
  const profile = await prisma.userLearningProfile.findUnique({
    select: { memoryEnabled: true },
    where: { userId },
  });

  return profile?.memoryEnabled ?? true;
}
