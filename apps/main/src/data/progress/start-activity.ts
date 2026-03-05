import "server-only";
import { prisma } from "@zoonk/db";

export async function startActivity(userId: number, activityId: bigint): Promise<void> {
  await prisma.activityProgress.upsert({
    create: { activityId, userId },
    update: {},
    where: { userActivity: { activityId, userId } },
  });
}
