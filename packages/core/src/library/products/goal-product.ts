/**
 * `courseTitle` is what the graph titles the product's course: the product's name for its main
 * course, the named release's for a pinned one.
 */
export type GoalProduct = {
  brand: string;
  courseTitle: string;
  id: string;
  name: string;
  pinnedReleaseId: string | null;
};

export const GOAL_PRODUCT_SELECT = {
  product: { select: { id: true, name: true, organization: { select: { name: true } } } },
  productRelease: { select: { id: true, name: true } },
} as const;

export function toGoalProduct(goal: {
  product: { id: string; name: string; organization: { name: string } } | null;
  productRelease: { id: string; name: string } | null;
}): GoalProduct | null {
  const { product, productRelease } = goal;

  if (!product) {
    return null;
  }

  return {
    brand: product.organization.name,
    courseTitle: productRelease?.name ?? product.name,
    id: product.id,
    name: product.name,
    pinnedReleaseId: productRelease?.id ?? null,
  };
}
