import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { type ReviewTaskType } from "@/lib/review-utils";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListReviewedItems = cache(async function cachedListReviewedItems(
  taskType: string,
  status: string,
  limit: number,
  offset: number,
) {
  if (!(await isAdmin())) {
    return { items: [], total: 0 };
  }
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
});

export async function listReviewedItems(params: {
  taskType: ReviewTaskType;
  status: string;
  limit: number;
  offset: number;
}) {
  return cachedListReviewedItems(params.taskType, params.status, params.limit, params.offset);
}
