import {
  generateSelectImageStep,
  type SelectImageStepParams,
} from "@zoonk/ai/tasks/steps/select-image";
import { AI_ORG_SLUG, SLUG_MAX_LENGTH } from "@zoonk/utils/constants";
import { toSlug } from "@zoonk/utils/string";
import { optimizeImage } from "../images/optimize-image";
import { uploadImage } from "../images/upload-image";
import type { SafeReturn } from "@zoonk/utils/error";

export type GenerateStepImageParams = SelectImageStepParams & {
  orgSlug?: string;
};

export async function generateStepImage({
  orgSlug,
  prompt,
  ...rest
}: GenerateStepImageParams): Promise<SafeReturn<string>> {
  const { data: image, error: imageGenerationError } = await generateSelectImageStep({
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

  const slug = toSlug(prompt.substring(0, SLUG_MAX_LENGTH));
  const org = orgSlug ?? AI_ORG_SLUG;
  const fileName = `steps/${org}/${slug}.webp`;

  const { data: url, error: uploadError } = await uploadImage({
    fileName,
    image: optimized,
  });

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  return { data: url, error: null };
}
