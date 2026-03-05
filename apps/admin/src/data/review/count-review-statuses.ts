import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { type ReviewTaskType } from "@/lib/review-utils";
import { prisma } from "@zoonk/db";
import { cache } from "react";
import { countPendingForTask } from "./count-pending-reviews";

export const countReviewStatuses = cache(async function countReviewStatuses(
  taskType: ReviewTaskType,
): Promise<{
  pending: number;
  needsChanges: number;
}> {
  if (!(await isAdmin())) {
    return { needsChanges: 0, pending: 0 };
  }

  const [pending, needsChanges] = await Promise.all([
    countPendingForTask(taskType),
    prisma.contentReview.count({
      where: { status: "needsChanges", taskType },
    }),
  ]);

  return { needsChanges, pending };
});
