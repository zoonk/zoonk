import {
  type StepContentImageParams,
  generateStepContentImage,
} from "@zoonk/ai/tasks/steps/content-image";
import { type SafeReturn } from "@zoonk/utils/error";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { toSlug } from "@zoonk/utils/string";
import { isNearSolidImage } from "../images/image-quality";
import { optimizeImage } from "../images/optimize-image";
import { uploadImage } from "../images/upload-image";

const STEP_CONTENT_IMAGE_ATTEMPTS = 2;
const NEAR_SOLID_IMAGE_ERROR = "Generated image was near-solid color";

/**
 * Generates and optimizes the image before upload so unusable model output can
 * be rejected while workflow retries are still cheap. We inspect the optimized
 * bytes because those are the exact bytes that would otherwise be stored.
 */
async function generateOptimizedContentImage({
  attemptsRemaining,
  ...params
}: StepContentImageParams & { attemptsRemaining: number }): Promise<SafeReturn<Buffer>> {
  const { data: image, error: imageGenerationError } = await generateStepContentImage(params);

  if (imageGenerationError) {
    return { data: null, error: imageGenerationError };
  }

  const { data: optimized, error: optimizeError } = await optimizeImage({
    image: Buffer.from(image.uint8Array),
  });

  if (optimizeError) {
    return { data: null, error: optimizeError };
  }

  const { data: isNearSolid, error: qualityError } = await isNearSolidImage({ image: optimized });

  if (qualityError) {
    return { data: null, error: qualityError };
  }

  if (!isNearSolid) {
    return { data: optimized, error: null };
  }

  if (attemptsRemaining > 1) {
    return generateOptimizedContentImage({ ...params, attemptsRemaining: attemptsRemaining - 1 });
  }

  return { data: null, error: new Error(NEAR_SOLID_IMAGE_ERROR) };
}

/**
 * Step images share the same optimize-and-upload pipeline, but not every
 * learner-visible image wants the same generation preset. Explanation steps
 * use the illustration preset, while practice steps can opt into a more
 * realistic preset without forking the storage flow.
 */
export async function generateContentStepImage({
  orgSlug,
  prompt,
  ...rest
}: StepContentImageParams & { orgSlug?: string }): Promise<SafeReturn<string>> {
  const { data: optimized, error: imageError } = await generateOptimizedContentImage({
    attemptsRemaining: STEP_CONTENT_IMAGE_ATTEMPTS,
    prompt,
    ...rest,
  });

  if (imageError) {
    return { data: null, error: imageError };
  }

  const slug = toSlug(prompt);
  const org = orgSlug ?? AI_ORG_SLUG;
  const fileName = `steps/${org}/content-${slug}.webp`;

  const { data: url, error: uploadError } = await uploadImage({ fileName, image: optimized });

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  return { data: url, error: null };
}
