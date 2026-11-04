import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";

export async function isMemoryEnabled(
  userId: string,
  client: TransactionClient = prisma,
): Promise<boolean> {
  const profile = await client.userLearningProfile.findUnique({
    select: { memoryEnabled: true },
    where: { userId },
  });

  return profile?.memoryEnabled ?? true;
}
