import "server-only";
import { prisma } from "@zoonk/db";
import { type GoalProductLink } from "./link-goal-product";

/**
 * Internal workflow bridge for research: a goal started from a product's course studies that
 * product, and that course's release only when the course is pinned to it.
 */
export async function findCourseProductLink(goalId: string): Promise<GoalProductLink | null> {
  const goal = await prisma.goal.findUnique({
    select: {
      primaryCourse: { select: { isPinned: true, productId: true, productReleaseId: true } },
    },
    where: { id: goalId },
  });

  const course = goal?.primaryCourse;

  if (!course?.productId) {
    return null;
  }

  return {
    productId: course.productId,
    productReleaseId: course.isPinned ? course.productReleaseId : null,
  };
}

/**
 * Internal workflow bridge for research: the page the freshness sweep re-reads while learners use
 * the product, its releases page, else its docs. Marketing pages change too often to follow.
 */
export async function findProductCheckedSourceId(productId: string): Promise<string | null> {
  const product = await prisma.product.findUnique({
    select: { docsUrl: true, releasesSourceId: true },
    where: { id: productId },
  });

  if (!product) {
    return null;
  }

  if (product.releasesSourceId || !product.docsUrl) {
    return product.releasesSourceId;
  }

  const docs = await prisma.source.findFirst({
    select: { id: true },
    where: { productId, url: product.docsUrl },
  });

  return docs?.id ?? null;
}
