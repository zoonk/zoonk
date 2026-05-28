import { getCourse } from "@/data/courses/get-course";
import { getDefaultChapterImage } from "@/lib/catalog/default-images";
import {
  catalogOpenGraphImageContentType,
  catalogOpenGraphImageSize,
  createCatalogOpenGraphImage,
} from "@/lib/metadata/catalog-opengraph-image";

type Props = { params: Promise<{ brandSlug: string; courseSlug: string }> };

export const alt = "Zoonk course preview";
export const contentType = catalogOpenGraphImageContentType;
export const size = catalogOpenGraphImageSize;

/**
 * Course pages are the top-level catalog share target, so their preview uses
 * the course thumbnail when available and falls back to category-aligned art.
 */
export default async function Image({ params }: Props) {
  const { brandSlug, courseSlug } = await params;
  const course = await getCourse({ brandSlug, courseSlug });

  if (!course) {
    return createCatalogOpenGraphImage({
      description: null,
      fallbackImagePath: "/catalog/chapters/general.webp",
      title: "Zoonk",
    });
  }

  return createCatalogOpenGraphImage({
    description: course.description,
    fallbackImagePath: getDefaultChapterImage({ categories: course.categories }),
    imageUrl: course.imageUrl,
    title: course.title,
  });
}
