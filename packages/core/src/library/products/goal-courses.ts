import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { findOrCreateGoalCourse } from "../curriculum/find-or-create-goal-course";
import { type GoalProduct } from "./goal-product";
import { findOrCreateProductCourse } from "./product-course";
import { toNameKey, whereProductNamed } from "./product-keys";

type GoalCourseRequest = Parameters<typeof findOrCreateGoalCourse>[0] & {
  product: GoalProduct | null;
};

/** Only when exactly one product has that name or alias, so a namesake never decides. */
async function findKnownProductId(nameKey: string): Promise<string | null> {
  const products = await prisma.product.findMany({
    select: { id: true },
    take: 2,
    where: whereProductNamed(nameKey),
  });

  const [only] = products;
  return products.length === 1 && only ? only.id : null;
}

async function findProductCourseKey({ product, title }: { product: GoalProduct; title: string }) {
  const nameKey = toNameKey(title);

  if (!nameKey) {
    return null;
  }

  if (nameKey === toNameKey(product.courseTitle)) {
    return { pinnedReleaseId: product.pinnedReleaseId, productId: product.id };
  }

  const productId = await findKnownProductId(nameKey);
  return productId ? { pinnedReleaseId: null, productId } : null;
}

/**
 * Internal workflow bridge: the goal must come from the learner's authorized run. In a shared
 * graph of a goal about a product, the course titled as the graph was told to title the product's
 * course is that product's course, and a course titled as another stored product is that product's
 * main course. Everything else, and every course of a private graph, is found as before.
 */
export async function findGoalProductCourse({
  product,
  provenance,
  scope,
  title,
}: Pick<GoalCourseRequest, "product" | "provenance" | "scope" | "title">) {
  if (!product || scope.ownerId !== null) {
    return null;
  }

  const key = await findProductCourseKey({ product, title });

  if (!key) {
    return null;
  }

  return findOrCreateProductCourse({ ...key, language: scope.language, provenance });
}

export async function findGoalCourse({
  product,
  ...request
}: GoalCourseRequest): Promise<{ course: Course; created: boolean }> {
  const productCourse = await findGoalProductCourse({ product, ...request });

  if (productCourse) {
    return productCourse;
  }

  return findOrCreateGoalCourse(request);
}
