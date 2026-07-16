import { getChapter } from "@/data/chapters/get-chapter";
import { getDefaultChapterImage } from "@/lib/catalog/default-images";
import {
  catalogOpenGraphImageContentType,
  catalogOpenGraphImageSize,
  createCatalogOpenGraphImage,
} from "@/lib/metadata/catalog-opengraph-image";

type Props = { params: Promise<{ brandSlug: string; chapterSlug: string; courseSlug: string }> };

export const alt = "Zoonk chapter preview";
export const contentType = catalogOpenGraphImageContentType;
export const size = catalogOpenGraphImageSize;

/**
 * Chapter shares should still feel anchored to the parent course, so the card
 * combines chapter artwork with the course title and course categories.
 */
export default async function Image({ params }: Props) {
  const { brandSlug, chapterSlug, courseSlug } = await params;
  const chapter = await getChapter({ brandSlug, chapterSlug, courseSlug });

  if (!chapter) {
    return createCatalogOpenGraphImage({
      description: null,
      fallbackImagePath: "/catalog/chapters/general.webp",
      title: "Zoonk",
    });
  }

  return createCatalogOpenGraphImage({
    description: chapter.course.description,
    fallbackImagePath: getDefaultChapterImage({ categories: chapter.course.categories }),
    imageUrl: chapter.imageUrl,
    title: chapter.course.title,
  });
}
