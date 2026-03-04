import "server-only";
import { type ReviewTaskType } from "@/lib/review-utils";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { countPendingForTask } from "./count-pending-reviews";

export async function countReviewStatuses(taskType: ReviewTaskType): Promise<{
  pending: number;
  needsChanges: number;
}> {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return { needsChanges: 0, pending: 0 };
  }

  const [pending, needsChanges] = await Promise.all([
    countPendingForTask(taskType),
    prisma.contentReview.count({
      where: { status: "needsChanges", taskType },
    }),
  ]);

  return { needsChanges, pending };
}
