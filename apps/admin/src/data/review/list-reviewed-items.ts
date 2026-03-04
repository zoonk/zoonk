import "server-only";
import { type ReviewTaskType } from "@/lib/review-utils";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";

export async function listReviewedItems(params: {
  taskType: ReviewTaskType;
  status: string;
  limit: number;
  offset: number;
}) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return { items: [], total: 0 };
  }

  const { taskType, status, limit, offset } = params;
  const where = { status, taskType };

  const [items, total] = await Promise.all([
    prisma.aiContentReview.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { reviewedAt: "desc" },
      skip: offset,
      take: limit,
      where,
    }),
    prisma.aiContentReview.count({ where }),
  ]);

  return { items, total };
}
