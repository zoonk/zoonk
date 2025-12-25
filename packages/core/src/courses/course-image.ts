import {
  type CourseThumbnailParams,
  generateCourseThumbnail,
} from "@zoonk/ai/course-thumbnail";
import type { SafeReturn } from "@zoonk/utils/error";
import { toSlug } from "@zoonk/utils/string";
import { optimizeImage } from "../images/optimize-image";
import { uploadImage } from "../images/upload-image";

export async function generateCourseImage(
  params: CourseThumbnailParams,
): Promise<SafeReturn<string>> {
  const { data: image, error: imageGenerationError } =
    await generateCourseThumbnail(params);

  if (imageGenerationError) {
    return { data: null, error: imageGenerationError };
  }

  const { data: optimized, error: optimizeError } = await optimizeImage({
    image: Buffer.from(image.uint8Array),
  });

  if (optimizeError) {
    return { data: null, error: optimizeError };
  }

  const slug = toSlug(params.title);
  const fileName = `courses/${slug}.webp`;

  const { data: url, error: uploadError } = await uploadImage({
    fileName,
    image: optimized,
  });

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  return { data: url, error: null };
}
