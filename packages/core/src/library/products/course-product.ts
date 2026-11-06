import { type CourseOutlineParams } from "@zoonk/ai/tasks/curriculum/course-outline";
import { type CourseGetPayload } from "@zoonk/db";

type PromptProduct = NonNullable<CourseOutlineParams["product"]>;

export const COURSE_PRODUCT_SELECT = {
  product: { select: { name: true, organization: { select: { name: true } } } },
  productRelease: { select: { name: true, releasedAt: true } },
} as const;

type CourseProduct = CourseGetPayload<{ select: typeof COURSE_PRODUCT_SELECT }>;

/** What a product course's outline and lessons are written for; null for any other course. */
export function toPromptProduct(course: CourseProduct): PromptProduct | null {
  const { product, productRelease } = course;

  if (!product) {
    return null;
  }

  return {
    brand: product.organization.name,
    name: product.name,
    release: productRelease && {
      name: productRelease.name,
      releasedOn: productRelease.releasedAt?.toISOString().slice(0, 10) ?? null,
    },
  };
}
