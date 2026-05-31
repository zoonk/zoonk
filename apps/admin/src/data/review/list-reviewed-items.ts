import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type ReviewTaskType } from "@/lib/review-utils";
import { prisma } from "@zoonk/db";

const cachedListReviewedItems = cacheAdminData(
  async (taskType: string, status: string, limit: number, offset: number) => {
    const where = { status, taskType };

    const [items, total] = await Promise.all([
      prisma.contentReview.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { reviewedAt: "desc" },
        skip: offset,
        take: limit,
        where,
      }),
      prisma.contentReview.count({ where }),
    ]);

    return { items, total };
  },
);

export async function listReviewedItems(params: {
  taskType: ReviewTaskType;
  status: string;
  limit: number;
  offset: number;
}) {
  return cachedListReviewedItems(params.taskType, params.status, params.limit, params.offset);
}
