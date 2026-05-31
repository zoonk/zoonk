import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type ReviewTaskType } from "@/lib/review-utils";
import { prisma } from "@zoonk/db";
import { countPendingForTask } from "./count-pending-reviews";

export const countReviewStatuses = cacheAdminData(
  async (taskType: ReviewTaskType): Promise<{ pending: number; needsChanges: number }> => {
    const [pending, needsChanges] = await Promise.all([
      countPendingForTask(taskType),
      prisma.contentReview.count({ where: { status: "needsChanges", taskType } }),
    ]);

    return { needsChanges, pending };
  },
);
