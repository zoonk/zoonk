import "server-only";
import { prisma } from "@zoonk/db";

/**
 * The player shell calls this as soon as a learner opens an activity so the
 * completion write can later distinguish "started" from "never seen". Using an
 * upsert keeps repeated page visits idempotent and preserves any existing
 * completion metadata instead of resetting progress.
 */
export async function startActivity(params: { activityId: string; userId: string }): Promise<void> {
  await prisma.activityProgress.upsert({
    create: { activityId: params.activityId, userId: params.userId },
    update: {},
    where: { userActivity: { activityId: params.activityId, userId: params.userId } },
  });
}
