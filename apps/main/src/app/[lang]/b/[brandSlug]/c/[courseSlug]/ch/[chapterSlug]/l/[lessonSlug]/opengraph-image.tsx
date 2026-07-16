import { getLesson } from "@/data/lessons/get-lesson";
import { getDefaultLessonImage } from "@/lib/catalog/default-images";
import {
  catalogOpenGraphImageContentType,
  catalogOpenGraphImageSize,
  createCatalogOpenGraphImage,
} from "@/lib/metadata/catalog-opengraph-image";

type Props = {
  params: Promise<{
    brandSlug: string;
    chapterSlug: string;
    courseSlug: string;
    lessonSlug: string;
  }>;
};

export const alt = "Zoonk lesson preview";
export const contentType = catalogOpenGraphImageContentType;
export const size = catalogOpenGraphImageSize;

/**
 * Lesson shares should promote the course, not the internal lesson metadata, so
 * the card keeps the lesson image but uses the parent course copy.
 */
export default async function Image({ params }: Props) {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;
  const lesson = await getLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lesson) {
    return createCatalogOpenGraphImage({
      description: null,
      fallbackImagePath: "/catalog/lessons/explanation.webp",
      title: "Zoonk",
    });
  }

  return createCatalogOpenGraphImage({
    description: lesson.chapter.course.description,
    fallbackImagePath: getDefaultLessonImage(lesson.kind),
    imageUrl: lesson.imageUrl,
    title: lesson.chapter.course.title,
  });
}
