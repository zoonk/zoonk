import {
  catalogOpenGraphImageContentType,
  catalogOpenGraphImageSize,
} from "@/lib/metadata/catalog-opengraph-image";
import { createCourseOpenGraphImage } from "@/lib/metadata/course-opengraph-image";

type Props = { params: Promise<{ brandSlug: string; courseSlug: string }> };

export const alt = "Zoonk lesson preview";
export const contentType = catalogOpenGraphImageContentType;
export const size = catalogOpenGraphImageSize;

/** Lesson shares promote the course they belong to, so they use the course's card. */
export default async function Image({ params }: Props) {
  const { brandSlug, courseSlug } = await params;
  return createCourseOpenGraphImage({ brandSlug, courseSlug });
}
