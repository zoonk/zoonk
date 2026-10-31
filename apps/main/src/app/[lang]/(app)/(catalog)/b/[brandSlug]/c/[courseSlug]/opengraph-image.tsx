import {
  catalogOpenGraphImageContentType,
  catalogOpenGraphImageSize,
} from "@/lib/metadata/catalog-opengraph-image";
import { createCourseOpenGraphImage } from "@/lib/metadata/course-opengraph-image";

type Props = { params: Promise<{ brandSlug: string; courseSlug: string }> };

export const alt = "Zoonk course preview";
export const contentType = catalogOpenGraphImageContentType;
export const size = catalogOpenGraphImageSize;

export default async function Image({ params }: Props) {
  const { brandSlug, courseSlug } = await params;
  return createCourseOpenGraphImage({ brandSlug, courseSlug });
}
