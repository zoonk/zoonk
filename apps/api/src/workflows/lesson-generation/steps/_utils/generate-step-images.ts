import { type StepContentImagePreset } from "@zoonk/ai/tasks/steps/content-image";
import { generateContentStepImage } from "@zoonk/core/steps/content-image";
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
