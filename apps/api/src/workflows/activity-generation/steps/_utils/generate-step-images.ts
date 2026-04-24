import {
  type StepContentImagePreset,
  generateContentStepImage,
} from "@zoonk/core/steps/content-image";
import { type StepImage } from "@zoonk/core/steps/contract/image";

function getImageUrlOrThrow({
  error,
  prompt,
  url,
}: {
  error: Error | null;
  prompt: string;
  url: string | null;
}) {
  if (error) {
    throw error;
  }

  if (!url) {
    throw new Error(`Image generation returned no URL for prompt: ${prompt}`);
  }

  return url;
}

/**
 * Step images are the only supported illustration output for explanation
 * and custom activities. Throwing on the first missing image keeps workflow
 * retries intact so we do not silently save half-finished activities.
 */
export async function generateStepImages({
  language,
  orgSlug,
  preset,
  prompts,
}: {
  language: string;
  orgSlug?: string;
  preset?: StepContentImagePreset;
  prompts: string[];
}): Promise<StepImage[]> {
  return Promise.all(
    prompts.map(async (prompt) => {
      const { data: url, error } = await generateContentStepImage({
        language,
        orgSlug,
        preset,
        prompt,
      });

      return {
        prompt,
        url: getImageUrlOrThrow({ error, prompt, url }),
      };
    }),
  );
}
