import {
  type StepContentImageParams,
  generateStepContentImage,
} from "@zoonk/ai/tasks/steps/content-image";
import { type SafeReturn } from "@zoonk/utils/error";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { toSlug } from "@zoonk/utils/string";
import { optimizeImage } from "../images/optimize-image";
import { uploadImage } from "../images/upload-image";

/**
 * Content-step illustrations share the same upload pipeline as quiz images,
 * but they use a different prompt template tuned for explanatory artwork.
 * Keeping that wrapper separate avoids mixing quiz-style prompts with lesson
 * illustration prompts.
 */
export async function generateContentStepImage({
  orgSlug,
  prompt,
  ...rest
}: StepContentImageParams & {
  orgSlug?: string;
}): Promise<SafeReturn<string>> {
  const { data: image, error: imageGenerationError } = await generateStepContentImage({
    prompt,
    ...rest,
  });

  if (imageGenerationError) {
    return { data: null, error: imageGenerationError };
  }

  const { data: optimized, error: optimizeError } = await optimizeImage({
    image: Buffer.from(image.uint8Array),
  });

  if (optimizeError) {
    return { data: null, error: optimizeError };
  }

  const slug = toSlug(prompt);
  const org = orgSlug ?? AI_ORG_SLUG;
  const fileName = `steps/${org}/content-${slug}.webp`;

  const { data: url, error: uploadError } = await uploadImage({
    fileName,
    image: optimized,
  });

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  return { data: url, error: null };
}
