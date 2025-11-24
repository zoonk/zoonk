import {
  type CourseThumbnailParams,
  generateCourseThumbnail,
} from "@zoonk/ai/course-thumbnail";
import type { SafeReturn } from "@zoonk/utils/error";
import slugify from "slugify";
import { uploadGeneratedImage } from "./upload";

export async function createCourseThumbnail(
  params: CourseThumbnailParams,
): Promise<SafeReturn<string>> {
  const { data: image, error: imageGenerationError } =
    await generateCourseThumbnail(params);

  if (imageGenerationError) {
    return { data: null, error: imageGenerationError };
  }

  const slug = slugify(params.title, { lower: true, strict: true });
  const fileName = `courses/${slug}.webp`;

  const { data: url, error: uploadError } = await uploadGeneratedImage({
    fileName,
    image,
  });

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  return { data: url, error: null };
}
