import "server-only";
import { getDefaultChapterImage } from "@/lib/catalog/default-images";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { createCatalogOpenGraphImage } from "./catalog-opengraph-image";

/**
 * The course's share card: its thumbnail when it has one, or art for its
 * category. Chapter and lesson pages without a card of their own share it too.
 */
export async function createCourseOpenGraphImage(params: {
  brandSlug: string;
  courseSlug: string;
}) {
  const course = await getCourse(params);

  return createCatalogOpenGraphImage({
    description: course?.description,
    fallbackImagePath: getDefaultChapterImage({ categories: course?.categories ?? [] }),
    imageUrl: course?.imageUrl,
    title: course?.title ?? "Zoonk",
  });
}
